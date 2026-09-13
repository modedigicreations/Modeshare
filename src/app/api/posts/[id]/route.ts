import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'
import { rewritePost } from '@/lib/deepseek'
import { scheduleBufferPost } from '@/lib/buffer'
import { scheduleFacebookPost } from '@/lib/facebook'
import { postTweet } from '@/lib/twitter'
import { postLinkedInShare } from '@/lib/linkedin'
import { Platform } from '@/types/database'

const updateSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve'),
    scheduled_at: z.string().optional(),
  }),
  z.object({
    action: z.literal('reject'),
    reviewer_note: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal('edit'),
    content: z.string().min(1).max(63206),
  }),
  z.object({
    action: z.literal('rewrite'),
    instruction: z.string().min(1).max(500),
  }),
])

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : supabase

    // Only approvers/admins can act on posts
    const { data: profile } = await db
      .from('profiles')
      .select('role, facebook_provider, twitter_provider, linkedin_provider')
      .eq('id', user.id)
      .single()

    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { action } = parsed.data

    // Creators can only edit their own pending posts
    if (action === 'edit') {
      const { data: post } = await db
        .from('posts')
        .select('user_id, status')
        .eq('id', id)
        .single()

      if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

      const canEdit =
        profile?.role !== 'creator' ||
        (post.user_id === user.id && post.status === 'pending_review')

      if (!canEdit) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const { data, error } = await db
        .from('posts')
        .update({ content: parsed.data.content })
        .eq('id', id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ post: data })
    }

    // Approve / reject require approver or admin
    if (profile?.role === 'creator') {
      return NextResponse.json({ error: 'Forbidden — approver role required' }, { status: 403 })
    }

    if (action === 'approve') {
      const updates: Record<string, unknown> = {
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        reviewer_note: null,
      }
      if (parsed.data.scheduled_at) {
        updates.scheduled_at = parsed.data.scheduled_at
      }

      const { data: postData, error } = await db
        .from('posts')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error || !postData) return NextResponse.json({ error: error?.message || 'Post not found' }, { status: 500 })

      let post = postData

      let autoScheduled = false
      let autoScheduleError: string | null = null

      try {
        const platform = post.platform as Platform
        const fbProvider = profile?.facebook_provider || 'buffer'
        const twProvider = profile?.twitter_provider || 'buffer'
        const liProvider = profile?.linkedin_provider || 'buffer'

        if (platform === 'facebook' && fbProvider === 'facebook_api') {
          // Direct Facebook API Auto-Scheduling
          let { data: fbConn } = await db
            .from('facebook_connections')
            .select('*')
            .eq('user_id', user.id)
            .single()

          if (!fbConn) {
            const { data: authorConn } = await db
              .from('facebook_connections')
              .select('*')
              .eq('user_id', post.user_id)
              .single()
            if (authorConn) fbConn = authorConn
          }

          if (!fbConn) {
            const { data: anyConn } = await db
              .from('facebook_connections')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(1)
              .single()
            if (anyConn) fbConn = anyConn
          }

          if (fbConn && fbConn.page_access_token && fbConn.page_id) {
            const fbResult = await scheduleFacebookPost(
              fbConn.page_access_token,
              fbConn.page_id,
              post.content,
              post.scheduled_at
            )

            const { data: updatedPost, error: updateErr } = await db
              .from('posts')
              .update({
                status: fbResult.isScheduled ? 'scheduled' : 'published',
                facebook_post_id: fbResult.id,
                published_provider: 'facebook_api',
                scheduled_at: post.scheduled_at || new Date().toISOString(),
                published_at: fbResult.isScheduled ? null : new Date().toISOString(),
              })
              .eq('id', id)
              .select()
              .single()

            if (!updateErr && updatedPost) {
              post = updatedPost
              autoScheduled = true
            }
          }
        } else if (platform === 'twitter' && twProvider === 'twitter_api') {
          // Direct Twitter API Auto-Publishing
          let { data: twConn } = await db
            .from('twitter_connections')
            .select('*')
            .eq('user_id', user.id)
            .single()

          if (!twConn) {
            const { data: authorConn } = await db
              .from('twitter_connections')
              .select('*')
              .eq('user_id', post.user_id)
              .single()
            if (authorConn) twConn = authorConn
          }

          if (!twConn) {
            const { data: anyConn } = await db
              .from('twitter_connections')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(1)
              .single()
            if (anyConn) twConn = anyConn
          }

          if (twConn && twConn.access_token) {
            const twResult = await postTweet(twConn.access_token, post.content)
            const { data: updatedPost, error: updateErr } = await db
              .from('posts')
              .update({
                status: 'published',
                twitter_post_id: twResult.id,
                published_provider: 'twitter_api',
                scheduled_at: post.scheduled_at || new Date().toISOString(),
                published_at: new Date().toISOString(),
              })
              .eq('id', id)
              .select()
              .single()

            if (!updateErr && updatedPost) {
              post = updatedPost
              autoScheduled = true
            }
          }
        } else if (platform === 'linkedin' && liProvider === 'linkedin_api') {
          // Direct LinkedIn API Auto-Publishing
          let { data: liConn } = await db
            .from('linkedin_connections')
            .select('*')
            .eq('user_id', user.id)
            .single()

          if (!liConn) {
            const { data: authorConn } = await db
              .from('linkedin_connections')
              .select('*')
              .eq('user_id', post.user_id)
              .single()
            if (authorConn) liConn = authorConn
          }

          if (!liConn) {
            const { data: anyConn } = await db
              .from('linkedin_connections')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(1)
              .single()
            if (anyConn) liConn = anyConn
          }

          if (liConn && liConn.access_token && liConn.account_id) {
            const liResult = await postLinkedInShare(liConn.access_token, liConn.account_id, post.content)
            const { data: updatedPost, error: updateErr } = await db
              .from('posts')
              .update({
                status: 'published',
                linkedin_post_id: liResult.id,
                published_provider: 'linkedin_api',
                scheduled_at: post.scheduled_at || new Date().toISOString(),
                published_at: new Date().toISOString(),
              })
              .eq('id', id)
              .select()
              .single()

            if (!updateErr && updatedPost) {
              post = updatedPost
              autoScheduled = true
            }
          }
        } else {
          // Buffer Auto-Scheduling Fallback
          let { data: bufferConn } = await db
            .from('buffer_connections')
            .select('*')
            .eq('user_id', user.id)
            .single()

          let profileId = bufferConn
            ? (bufferConn.profile_ids as Record<string, string>)[platform]
            : undefined

          if (!profileId) {
            const { data: authorConn } = await db
              .from('buffer_connections')
              .select('*')
              .eq('user_id', post.user_id)
              .single()
            if (authorConn) {
              bufferConn = authorConn
              profileId = (authorConn.profile_ids as Record<string, string>)[platform]
            }
          }

          if (!profileId) {
            const { data: anyConn } = await db
              .from('buffer_connections')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(1)
              .single()
            if (anyConn) {
              bufferConn = anyConn
              profileId = (anyConn.profile_ids as Record<string, string>)[platform]
            }
          }

          if (profileId && bufferConn) {
            const bufferId = await scheduleBufferPost(
              bufferConn.access_token,
              profileId,
              post.content,
              post.scheduled_at,
              platform
            )

            const { data: updatedPost, error: updateErr } = await db
              .from('posts')
              .update({
                status: 'scheduled',
                buffer_post_id: bufferId,
                published_provider: 'buffer',
                scheduled_at: post.scheduled_at || new Date().toISOString(),
              })
              .eq('id', id)
              .select()
              .single()

            if (!updateErr && updatedPost) {
              post = updatedPost
              autoScheduled = true
            }
          }
        }
      } catch (err) {
        console.error('Auto-schedule failed on approval:', err)
        autoScheduleError = err instanceof Error ? err.message : String(err)
      }

      return NextResponse.json({ post, autoScheduled, autoScheduleError })
    }

    if (action === 'rewrite') {
      const { data: post } = await db
        .from('posts')
        .select('*')
        .eq('id', id)
        .single()

      if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

      const canEdit =
        profile?.role !== 'creator' ||
        (post.user_id === user.id && post.status === 'pending_review')

      if (!canEdit) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const rewritten = await rewritePost(
        post.platform as Platform,
        post.content,
        parsed.data.instruction
      )

      const { data, error } = await db
        .from('posts')
        .update({ content: rewritten })
        .eq('id', id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ post: data })
    }

    if (action === 'reject') {
      const { data, error } = await db
        .from('posts')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          reviewer_note: parsed.data.reviewer_note || null,
        })
        .eq('id', id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ post: data })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    console.error('Post PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
