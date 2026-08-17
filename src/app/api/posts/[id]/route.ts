import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

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

    // Only approvers/admins can act on posts
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
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
      const { data: post } = await supabase
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

      const { data, error } = await supabase
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

      const { data, error } = await supabase
        .from('posts')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ post: data })
    }

    if (action === 'reject') {
      const { data, error } = await supabase
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
