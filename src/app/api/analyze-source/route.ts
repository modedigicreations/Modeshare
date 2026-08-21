import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'

// Helper to strip HTML tags to get raw text content
function cleanHtml(html: string): string {
  return html
    .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
    .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { url, text } = await request.json()
    let sourceText = ''

    if (url) {
      const targetUrl = url.trim()
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        return NextResponse.json({ error: 'Invalid URL scheme. Must start with http:// or https://' }, { status: 400 })
      }

      const res = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        next: { revalidate: 3600 },
      })
      if (!res.ok) {
        throw new Error(`Failed to fetch URL: ${res.statusText}`)
      }
      const html = await res.text()
      sourceText = cleanHtml(html)
    } else if (text) {
      sourceText = text.trim()
    }

    if (!sourceText) {
      return NextResponse.json({ error: 'Please provide either a valid URL or raw source text.' }, { status: 400 })
    }

    // Limit text to avoid exceeding LLM context windows in simple usage
    const limitedText = sourceText.slice(0, 5000)

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
            content: 'You are a social media copywriter assistant. You extract key topics and write concise social media briefs from raw source content. Return only a valid JSON response with no explanations or markdown.',
          },
          {
            role: 'user',
            content: `Analyze the following source content and extract details to propose a social media post brief.

Source Content:
"""
${limitedText}
"""

Output a strict JSON object with these fields:
1. "topic": A concise suggested topic/headline (maximum 100 characters).
2. "description": A summarized context of key highlights, takeaways, or references (maximum 500 characters).
3. "tone": Must be exactly one of: "professional", "casual", "witty", "informative", or "inspirational".

Remember: Output ONLY the JSON object, no markdown code blocks, no other text.`,
          },
        ],
        temperature: 0.6,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`DeepSeek API error ${response.status}: ${errText}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) throw new Error('Empty response from Deepseek')

    const parsed = JSON.parse(content)
    return NextResponse.json({ success: true, brief: parsed })
  } catch (err) {
    console.error('Analyze source route error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Analysis failed' }, { status: 500 })
  }
}
