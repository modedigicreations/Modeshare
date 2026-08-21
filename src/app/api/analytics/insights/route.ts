import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'

interface PostMetrics {
  reactions?: number
  clicks?: number
  reposts?: number
  comments?: number
}

export async function GET(request: NextRequest) {
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

    // Fetch posts with metrics and their briefs (for tone info)
    let query = supabase
      .from('posts')
      .select('platform, metrics, brief:briefs(tone)')
      .not('buffer_post_id', 'is', null)

    if (!isSuperAdmin) {
      query = query.eq('user_id', user.id)
    }

    const { data: posts, error } = await query
    if (error || !posts) {
      return NextResponse.json({ error: error?.message || 'Failed to fetch performance data' }, { status: 500 })
    }

    // Filter posts that actually have synced metrics
    const postsWithMetrics = posts.filter(
      (p) => p.metrics && typeof p.metrics === 'object' && Object.keys(p.metrics).length > 0
    )

    if (postsWithMetrics.length === 0) {
      return NextResponse.json({
        insights: '### Not enough performance data yet\n\nSchedule posts and click **Sync Metrics** to load your performance history and unlock custom AI-driven suggestions!',
      })
    }

    // Perform aggregates
    let totalReactions = 0
    let totalClicks = 0
    let totalReposts = 0
    let totalComments = 0

    const platformStats: Record<string, { posts: number; reactions: number; clicks: number }> = {}
    const toneStats: Record<string, { posts: number; reactions: number; clicks: number }> = {}

    for (const post of postsWithMetrics) {
      const m = post.metrics as PostMetrics
      const reactions = m.reactions || 0
      const clicks = m.clicks || 0
      const reposts = m.reposts || 0
      const comments = m.comments || 0

      totalReactions += reactions
      totalClicks += clicks
      totalReposts += reposts
      totalComments += comments

      // Platform breakdown
      const plat = post.platform
      if (!platformStats[plat]) {
        platformStats[plat] = { posts: 0, reactions: 0, clicks: 0 }
      }
      platformStats[plat].posts++
      platformStats[plat].reactions += reactions
      platformStats[plat].clicks += clicks

      // Tone breakdown
      const tone = (post.brief as { tone?: string })?.tone || 'unknown'
      if (!toneStats[tone]) {
        toneStats[tone] = { posts: 0, reactions: 0, clicks: 0 }
      }
      toneStats[tone].posts++
      toneStats[tone].reactions += reactions
      toneStats[tone].clicks += clicks
    }

    // Build prompt text
    const platformBreakdownText = Object.entries(platformStats)
      .map(([p, s]) => `- **${p}**: ${s.posts} posts, ${s.reactions} reactions, ${s.clicks} clicks`)
      .join('\n')

    const tonePerformanceText = Object.entries(toneStats)
      .map(([t, s]) => `- **${t}**: ${s.posts} posts, ${s.reactions} reactions, ${s.clicks} clicks`)
      .join('\n')

    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY is not configured')

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a social media copywriter and growth analyst. You review raw post statistics and write direct, constructive, markdown-formatted growth suggestions.',
          },
          {
            role: 'user',
            content: `Analyze the following social media performance metrics for Modeshare and generate 3 clear, actionable content suggestions.

SUMMARY:
- Total Posts Evaluated: ${postsWithMetrics.length}
- Total Likes/Reactions: ${totalReactions}
- Total Clicks: ${totalClicks}
- Total Reposts: ${totalReposts}
- Total Comments: ${totalComments}

PLATFORM BREAKDOWN:
${platformBreakdownText}

TONE PERFORMANCE:
${tonePerformanceText}

Provide:
- A brief evaluation highlighting which platform and tone combinations are producing the highest engagement.
- 3 clear, bulleted strategy recommendations (e.g. "Create more witty tweets...", "Focus on LinkedIn articles with informative tone...").
- Keep it concise and format the output in clean markdown. No quotes, no markdown code block wrappers (do not start with \`\`\`markdown).`,
          },
        ],
        temperature: 0.6,
        max_tokens: 1000,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`DeepSeek API error ${response.status}: ${err}`)
    }

    const data = await response.json()
    let insights = data.choices?.[0]?.message?.content?.trim()
    if (!insights) throw new Error('Empty insights from Deepseek')

    // Strip markdown formatting if returned by model
    if (insights.startsWith('```markdown')) {
      insights = insights.replace(/^```markdown\n/, '').replace(/\n```$/, '')
    } else if (insights.startsWith('```')) {
      insights = insights.replace(/^```\n/, '').replace(/\n```$/, '')
    }

    return NextResponse.json({ success: true, insights })
  } catch (err) {
    console.error('Insights route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
