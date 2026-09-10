import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPostMetrics as getBufferPostMetrics } from '@/lib/buffer'
import { getFacebookPostMetrics } from '@/lib/facebook'

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

    // Fetch posts that have been pushed to Buffer or Facebook
    let postsQuery = supabase
      .from('posts')
      .select('id, user_id, buffer_post_id, facebook_post_id, published_provider')
      .or('buffer_post_id.not.is.null,facebook_post_id.not.is.null')

    if (!isSuperAdmin) {
      postsQuery = postsQuery.eq('user_id', user.id)
    }

    const { data: posts, error: postsError } = await postsQuery
    if (postsError || !posts) {
      return NextResponse.json({ error: postsError?.message || 'Failed to fetch posts' }, { status: 500 })
    }

    let syncedCount = 0
    const syncErrors: Record<string, string> = {}

    // Group posts by user_id to cache connections
    const userIds = Array.from(new Set(posts.map((p) => p.user_id)))
    const bufferConnectionsMap: Record<string, string> = {}
    const facebookConnectionsMap: Record<string, string> = {}

    for (const uid of userIds) {
      const [bufferRes, fbRes] = await Promise.all([
        supabase
          .from('buffer_connections')
          .select('access_token')
          .eq('user_id', uid)
          .single(),
        supabase
          .from('facebook_connections')
          .select('page_access_token')
          .eq('user_id', uid)
          .single(),
      ])

      if (bufferRes.data?.access_token) {
        bufferConnectionsMap[uid] = bufferRes.data.access_token
      }
      if (fbRes.data?.page_access_token) {
        facebookConnectionsMap[uid] = fbRes.data.page_access_token
      }
    }

    // Perform concurrent metrics sync
    await Promise.allSettled(
      posts.map(async (post) => {
        try {
          let stats = { reactions: 0, clicks: 0, reposts: 0, comments: 0 }

          if (post.facebook_post_id) {
            const fbToken = facebookConnectionsMap[post.user_id]
            if (fbToken) {
              stats = await getFacebookPostMetrics(fbToken, post.facebook_post_id)
            }
          } else if (post.buffer_post_id) {
            const bufferToken = bufferConnectionsMap[post.user_id]
            if (bufferToken) {
              stats = await getBufferPostMetrics(bufferToken, post.buffer_post_id)
            }
          } else {
            return
          }

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

