import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPostMetrics as getBufferPostMetrics } from '@/lib/buffer'
import { getFacebookPostMetrics } from '@/lib/facebook'
import { getTwitterPostMetrics } from '@/lib/twitter'
import { getLinkedInPostMetrics } from '@/lib/linkedin'

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

    const isSuperAdmin = profile?.role === 'super_admin'

    // Fetch posts that have been pushed to Buffer, Facebook, Twitter, or LinkedIn
    let postsQuery = db
      .from('posts')
      .select('id, user_id, buffer_post_id, facebook_post_id, twitter_post_id, linkedin_post_id, published_provider')
      .or('buffer_post_id.not.is.null,facebook_post_id.not.is.null,twitter_post_id.not.is.null,linkedin_post_id.not.is.null')

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
    const twitterConnectionsMap: Record<string, string> = {}
    const linkedinConnectionsMap: Record<string, string> = {}

    if (userIds.length > 0) {
      const [bufferRes, fbRes, twRes, liRes] = await Promise.all([
        db
          .from('buffer_connections')
          .select('user_id, access_token')
          .in('user_id', userIds),
        db
          .from('facebook_connections')
          .select('user_id, page_access_token')
          .in('user_id', userIds),
        db
          .from('twitter_connections')
          .select('user_id, access_token')
          .in('user_id', userIds),
        db
          .from('linkedin_connections')
          .select('user_id, access_token')
          .in('user_id', userIds),
      ])

      if (bufferRes.data) {
        for (const conn of bufferRes.data) {
          if (conn.access_token) bufferConnectionsMap[conn.user_id] = conn.access_token
        }
      }

      if (fbRes.data) {
        for (const conn of fbRes.data) {
          if (conn.page_access_token) facebookConnectionsMap[conn.user_id] = conn.page_access_token
        }
      }

      if (twRes.data) {
        for (const conn of twRes.data) {
          if (conn.access_token) twitterConnectionsMap[conn.user_id] = conn.access_token
        }
      }

      if (liRes.data) {
        for (const conn of liRes.data) {
          if (conn.access_token) linkedinConnectionsMap[conn.user_id] = conn.access_token
        }
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
          } else if (post.twitter_post_id) {
            const twToken = twitterConnectionsMap[post.user_id]
            if (twToken) {
              stats = await getTwitterPostMetrics(twToken, post.twitter_post_id)
            }
          } else if (post.linkedin_post_id) {
            const liToken = linkedinConnectionsMap[post.user_id]
            if (liToken) {
              stats = await getLinkedInPostMetrics(liToken, post.linkedin_post_id)
            }
          } else if (post.buffer_post_id) {
            const bufferToken = bufferConnectionsMap[post.user_id]
            if (bufferToken) {
              stats = await getBufferPostMetrics(bufferToken, post.buffer_post_id)
            }
          } else {
            return
          }

          await db
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

