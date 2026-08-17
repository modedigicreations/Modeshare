import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { scheduleBufferPost } from '@/lib/buffer'
import { Platform } from '@/types/database'
import { z } from 'zod'

const schema = z.object({
  postId: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Only approvers/admins can push to Buffer
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
    if (post.status !== 'approved') {
      return NextResponse.json({ error: 'Post must be approved before scheduling' }, { status: 400 })
    }

    // Fetch Buffer connection — use the post author's connection if approver doesn't have one
    const { data: bufferConn } = await supabase
      .from('buffer_connections')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!bufferConn) {
      return NextResponse.json(
        { error: 'No Buffer account connected. Go to Settings to connect Buffer.' },
        { status: 400 }
      )
    }

    const platform = post.platform as Platform
    const profileId = (bufferConn.profile_ids as Record<string, string>)[platform]

    if (!profileId) {
      return NextResponse.json(
        { error: `No Buffer profile connected for ${platform}. Check your Settings.` },
        { status: 400 }
      )
    }

    // Push to Buffer
    const bufferId = await scheduleBufferPost(
      bufferConn.access_token,
      profileId,
      post.content,
      post.scheduled_at
    )

    // Update post status
    await supabase
      .from('posts')
      .update({
        status: 'scheduled',
        buffer_post_id: bufferId,
        scheduled_at: post.scheduled_at || new Date().toISOString(),
      })
      .eq('id', postId)

    return NextResponse.json({ success: true, bufferId })
  } catch (err) {
    console.error('Buffer schedule error:', err)
    const message = err instanceof Error ? err.message : 'Failed to schedule post'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
