import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generatePosts } from '@/lib/deepseek'
import { Platform } from '@/types/database'
import { z } from 'zod'
import { notifySuperAdmins } from '@/lib/email'

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

    // Trigger notification async
    notifySuperAdmins({
      subject: '🔔 Modeshare: New AI Posts Generated',
      html: `
        <div style="font-family: sans-serif; max-width: 550px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <h2 style="color: #0f172a; margin-top: 0; font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px;">AI Content Generated</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.5;">A user has generated social media posts via Modeshare:</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 14px;">
            <tr>
              <td style="padding: 8px 0; color: #64748b; width: 140px; border-bottom: 1px solid #f1f5f9;"><strong>User:</strong></td>
              <td style="padding: 8px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${user.email}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; border-bottom: 1px solid #f1f5f9;"><strong>Topic:</strong></td>
              <td style="padding: 8px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9; font-weight: 500;">${topic}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; border-bottom: 1px solid #f1f5f9;"><strong>Tone:</strong></td>
              <td style="padding: 8px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9; text-transform: capitalize;">${tone}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; border-bottom: 1px solid #f1f5f9;"><strong>Target Platforms:</strong></td>
              <td style="padding: 8px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9; text-transform: capitalize;">${platforms.join(', ')}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; border-bottom: 1px solid #f1f5f9;"><strong>Post Variants:</strong></td>
              <td style="padding: 8px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${variants.length} posts total</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; border-bottom: 1px solid #f1f5f9;"><strong>Generated At:</strong></td>
              <td style="padding: 8px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${new Date().toLocaleString()}</td>
            </tr>
          </table>
          <div style="margin-top: 24px; text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/briefs/${brief.id}" 
               style="display: inline-block; background-color: #003da5; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 10px 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,61,165,0.2);">
              Review Content In Dashboard
            </a>
          </div>
          <p style="margin-top: 24px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 12px;">This is an automated notification from Modeshare.</p>
        </div>
      `,
    }).catch((e) => console.error('Failed to notify super admin of generation:', e))

    return NextResponse.json({ briefId: brief.id, count: variants.length })
  } catch (err) {
    console.error('Generate route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
