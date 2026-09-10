import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { scheduleFacebookPost } from '@/lib/facebook'
import { z } from 'zod'

const schema = z.object({
  postId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Only approvers/admins can schedule posts
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role === 'creator') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const { postId } = parsed.data

    // Fetch post
    const { data: post } = await supabase
      .from('posts')
      .select('*')
      .eq('id', postId)
      .single()

    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    if (post.platform !== 'facebook') {
      return NextResponse.json({ error: 'Facebook API can only be used for Facebook posts' }, { status: 400 })
    }

    const isSuperAdmin = profile?.role === 'super_admin'
    if (post.status !== 'approved' && !isSuperAdmin) {
      return NextResponse.json({ error: 'Post must be approved before scheduling' }, { status: 400 })
    }

    // Fetch Facebook connection — use approver's connection or post author's connection
    let { data: fbConn } = await supabase
      .from('facebook_connections')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!fbConn) {
      const { data: authorConn } = await supabase
        .from('facebook_connections')
        .select('*')
        .eq('user_id', post.user_id)
        .single()
      if (authorConn) {
        fbConn = authorConn
      }
    }

    if (!fbConn || !fbConn.page_access_token || !fbConn.page_id) {
      return NextResponse.json(
        { error: 'No Facebook Page connected. Please connect your Facebook account in Settings.' },
        { status: 400 }
      )
    }

    // Push to Facebook Graph API
    const result = await scheduleFacebookPost(
      fbConn.page_access_token,
      fbConn.page_id,
      post.content,
      post.scheduled_at
    )

    // Update post status details
    const updateData: Record<string, unknown> = {
      facebook_post_id: result.id,
      published_provider: 'facebook_api',
    }

    if (post.status === 'approved') {
      updateData.status = result.isScheduled ? 'scheduled' : 'published'
      updateData.scheduled_at = post.scheduled_at || new Date().toISOString()
      if (!result.isScheduled) {
        updateData.published_at = new Date().toISOString()
      }
    }

    await supabase
      .from('posts')
      .update(updateData)
      .eq('id', postId)

    return NextResponse.json({
      success: true,
      facebookPostId: result.id,
      isScheduled: result.isScheduled,
    })
  } catch (err) {
    console.error('Facebook schedule error:', err)
    const message = err instanceof Error ? err.message : 'Failed to schedule post to Facebook'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
