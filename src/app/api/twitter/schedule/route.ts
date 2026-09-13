import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { postTweet, refreshTwitterToken } from '@/lib/twitter'
import { z } from 'zod'

const schema = z.object({
  postId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : supabase

    const { data: profile } = await db
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
    const { data: post } = await db
      .from('posts')
      .select('*')
      .eq('id', postId)
      .single()

    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    if (post.platform !== 'twitter') {
      return NextResponse.json({ error: 'Twitter API can only be used for Twitter posts' }, { status: 400 })
    }

    const isSuperAdmin = profile?.role === 'super_admin'
    if (post.status !== 'approved' && !isSuperAdmin) {
      return NextResponse.json({ error: 'Post must be approved before publishing' }, { status: 400 })
    }

    // Fetch Twitter connection
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

    if (!twConn || !twConn.access_token) {
      return NextResponse.json(
        { error: 'No Twitter account connected. Please connect your Twitter / X account in Settings.' },
        { status: 400 }
      )
    }

    // Check if token expired and refresh if possible
    let activeToken = twConn.access_token
    if (twConn.expires_at && new Date(twConn.expires_at).getTime() <= Date.now() + 60000 && twConn.refresh_token) {
      try {
        const refreshed = await refreshTwitterToken(twConn.refresh_token)
        activeToken = refreshed.accessToken
        const newExpiry = new Date(Date.now() + refreshed.expiresIn * 1000).toISOString()
        await db
          .from('twitter_connections')
          .update({
            access_token: refreshed.accessToken,
            refresh_token: refreshed.refreshToken,
            expires_at: newExpiry,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', twConn.user_id)
      } catch (refreshErr) {
        console.warn('Twitter token refresh warning:', refreshErr)
      }
    }

    // Publish tweet
    const tweetResult = await postTweet(activeToken, post.content)

    // Update post status
    const updateData: Record<string, unknown> = {
      twitter_post_id: tweetResult.id,
      published_provider: 'twitter_api',
    }

    if (post.status === 'approved') {
      updateData.status = 'published'
      updateData.published_at = new Date().toISOString()
      updateData.scheduled_at = post.scheduled_at || new Date().toISOString()
    }

    await db.from('posts').update(updateData).eq('id', postId)

    return NextResponse.json({
      success: true,
      tweetId: tweetResult.id,
    })
  } catch (err) {
    console.error('Twitter schedule error:', err)
    const msg = err instanceof Error ? err.message : 'Failed to publish post to Twitter / X'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
