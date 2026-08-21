import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPostMetrics } from '@/lib/buffer'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isSuperAdmin = profile?.role === 'super_admin'

    // Fetch posts that have been pushed to Buffer
    let postsQuery = supabase
      .from('posts')
      .select('id, user_id, buffer_post_id')
      .not('buffer_post_id', 'is', null)

    if (!isSuperAdmin) {
      postsQuery = postsQuery.eq('user_id', user.id)
    }

    const { data: posts, error: postsError } = await postsQuery
    if (postsError || !posts) {
      return NextResponse.json({ error: postsError?.message || 'Failed to fetch posts' }, { status: 500 })
    }

    let syncedCount = 0
    const syncErrors: Record<string, string> = {}

    // Group posts by user_id to cache buffer connections (saves DB query overhead)
    const userIds = Array.from(new Set(posts.map((p) => p.user_id)))
    const connectionsMap: Record<string, string> = {}

    for (const uid of userIds) {
      const { data: conn } = await supabase
        .from('buffer_connections')
        .select('access_token')
        .eq('user_id', uid)
        .single()
      if (conn?.access_token) {
        connectionsMap[uid] = conn.access_token
      }
    }

    // Perform concurrent metrics sync
    await Promise.allSettled(
      posts.map(async (post) => {
        const token = connectionsMap[post.user_id]
        if (!token || !post.buffer_post_id) return

        try {
          const stats = await getPostMetrics(token, post.buffer_post_id)

          await supabase
            .from('posts')
            .update({
              metrics: {
                reactions: stats.reactions,
                clicks: stats.clicks,
                reposts: stats.reposts,
                comments: stats.comments,
                updated_at: new Date().toISOString(),
              },
            })
            .eq('id', post.id)

          syncedCount++
        } catch (err) {
          console.error(`Failed to sync metrics for post ${post.id}:`, err)
          syncErrors[post.id] = err instanceof Error ? err.message : String(err)
        }
      })
    )

    return NextResponse.json({ success: true, count: syncedCount, errors: syncErrors })
  } catch (err) {
    console.error('Analytics sync error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
