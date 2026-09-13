import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { postLinkedInShare } from '@/lib/linkedin'
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
    if (post.platform !== 'linkedin') {
      return NextResponse.json({ error: 'LinkedIn API can only be used for LinkedIn posts' }, { status: 400 })
    }

    const isSuperAdmin = profile?.role === 'super_admin'
    if (post.status !== 'approved' && !isSuperAdmin) {
      return NextResponse.json({ error: 'Post must be approved before publishing' }, { status: 400 })
    }

    // Fetch LinkedIn connection
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

    if (!liConn || !liConn.access_token || !liConn.account_id) {
      return NextResponse.json(
        { error: 'No LinkedIn account or Company Page connected. Please connect your LinkedIn account in Settings.' },
        { status: 400 }
      )
    }

    // Publish to LinkedIn
    const result = await postLinkedInShare(liConn.access_token, liConn.account_id, post.content)

    // Update post status
    const updateData: Record<string, unknown> = {
      linkedin_post_id: result.id,
      published_provider: 'linkedin_api',
    }

    if (post.status === 'approved') {
      updateData.status = 'published'
      updateData.published_at = new Date().toISOString()
      updateData.scheduled_at = post.scheduled_at || new Date().toISOString()
    }

    await db.from('posts').update(updateData).eq('id', postId)

    return NextResponse.json({
      success: true,
      linkedinPostId: result.id,
    })
  } catch (err) {
    console.error('LinkedIn schedule error:', err)
    const msg = err instanceof Error ? err.message : 'Failed to publish post to LinkedIn'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
