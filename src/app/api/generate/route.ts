import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generatePosts } from '@/lib/deepseek'
import { Platform } from '@/types/database'
import { z } from 'zod'

const schema = z.object({
  topic: z.string().min(3).max(300),
  description: z.string().max(1000).optional(),
  tone: z.enum(['professional', 'casual', 'witty', 'informative', 'inspirational']),
  platforms: z.array(z.enum(['facebook', 'twitter', 'linkedin'])).min(1),
  target_date: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate body
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { topic, description, tone, platforms, target_date } = parsed.data

    // Save brief to DB
    const { data: brief, error: briefError } = await supabase
      .from('briefs')
      .insert({
        user_id: user.id,
        topic,
        description: description || null,
        tone,
        platforms,
        target_date: target_date || null,
        status: 'pending_generation',
      })
      .select()
      .single()

    if (briefError || !brief) {
      return NextResponse.json({ error: 'Failed to save brief' }, { status: 500 })
    }

    // Generate posts via DeepSeek
    let variants
    try {
      variants = await generatePosts({ topic, description, tone, platforms: platforms as Platform[] })
    } catch (err) {
      // Delete the brief since generation failed
      await supabase
        .from('briefs')
        .delete()
        .eq('id', brief.id)

      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Generation failed' },
        { status: 500 }
      )
    }

    // Save generated posts to DB
    const postsToInsert = variants.map((v) => ({
      brief_id: brief.id,
      user_id: user.id,
      platform: v.platform,
      variant_index: v.variant_index,
      content: v.content,
      status: 'pending_review',
    }))

    const { error: postsError } = await supabase
      .from('posts')
      .insert(postsToInsert)

    if (postsError) {
      return NextResponse.json({ error: 'Failed to save posts' }, { status: 500 })
    }

    // Update brief status
    await supabase
      .from('briefs')
      .update({ status: 'generated' })
      .eq('id', brief.id)

    return NextResponse.json({ briefId: brief.id, count: variants.length })
  } catch (err) {
    console.error('Generate route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
