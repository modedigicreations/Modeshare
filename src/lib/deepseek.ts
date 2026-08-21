import { Platform, Tone } from '@/types/database'
import { PLATFORM_CHAR_LIMITS } from '@/lib/utils'

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'

export interface GeneratePostsInput {
  topic: string
  description?: string
  tone: Tone
  platforms: Platform[]
}

export interface GeneratedVariant {
  platform: Platform
  variant_index: number
  content: string
}

const TONE_DESCRIPTIONS: Record<Tone, string> = {
  professional: 'formal, authoritative, business-appropriate',
  casual: 'friendly, conversational, approachable',
  witty: 'clever, humorous, playful with a smart edge',
  informative: 'educational, factual, clear and helpful',
  inspirational: 'motivating, uplifting, aspirational',
}

const PLATFORM_GUIDELINES: Record<Platform, string> = {
  facebook: `Facebook post — up to ${PLATFORM_CHAR_LIMITS.facebook} chars. Can be longer and more detailed. Use paragraphs, line breaks, and emojis naturally. End with a call to action or question to drive engagement.`,
  twitter: `Twitter/X post — STRICT ${PLATFORM_CHAR_LIMITS.twitter} character limit including spaces and emojis. Be punchy and direct. Can include 1-2 relevant hashtags. No filler words.`,
  linkedin: `LinkedIn post — up to ${PLATFORM_CHAR_LIMITS.linkedin} chars. Professional tone even if overall brief tone is casual. Structure with a hook first line, body content, and closing thought. Use line breaks for readability. Hashtags at the end are acceptable.`,
}

function buildPrompt(input: GeneratePostsInput): string {
  const platformInstructions = input.platforms
    .map((p) => `- ${PLATFORM_GUIDELINES[p]}`)
    .join('\n')

  return `You are a professional social media copywriter. Generate social media posts based on the brief below.

BRIEF:
Topic: ${input.topic}
${input.description ? `Additional context: ${input.description}` : ''}
Tone: ${TONE_DESCRIPTIONS[input.tone]}

PLATFORMS TO WRITE FOR:
${platformInstructions}

INSTRUCTIONS:
- Generate exactly 3 distinct variations for EACH platform listed above.
- Each variation should take a different angle or framing of the same topic.
- Respect character limits strictly, especially for Twitter/X.
- Do NOT include any explanation, labels, or markdown — output only valid JSON.

OUTPUT FORMAT (strict JSON, no markdown code blocks):
{
  "posts": [
    { "platform": "facebook", "variant_index": 1, "content": "..." },
    { "platform": "facebook", "variant_index": 2, "content": "..." },
    { "platform": "facebook", "variant_index": 3, "content": "..." },
    { "platform": "twitter", "variant_index": 1, "content": "..." }
    ...
  ]
}

Generate the posts now:`
}

export async function generatePosts(
  input: GeneratePostsInput
): Promise<GeneratedVariant[]> {
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
          content:
            'You are a social media copywriter. You output only valid JSON with no markdown formatting.',
        },
        {
          role: 'user',
          content: buildPrompt(input),
        },
      ],
      temperature: 0.8,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`DeepSeek API error ${response.status}: ${err}`)
  }

  const data = await response.json()
  const raw = data.choices?.[0]?.message?.content

  if (!raw) throw new Error('Empty response from DeepSeek')

  let parsed: { posts: GeneratedVariant[] }
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Failed to parse DeepSeek JSON response')
  }

  if (!Array.isArray(parsed.posts)) {
    throw new Error('Invalid response structure from DeepSeek')
  }

  // Enforce Twitter character limit — truncate if model exceeded it
  return parsed.posts.map((post) => {
    const limit = PLATFORM_CHAR_LIMITS[post.platform]
    if (post.content.length > limit) {
      post.content = post.content.slice(0, limit - 1).trimEnd() + '…'
    }
    return post
  })
}

export async function rewritePost(
  platform: Platform,
  originalContent: string,
  instruction: string
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY is not configured')

  const limit = PLATFORM_CHAR_LIMITS[platform]

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
          content: 'You are a social media copywriter. You rewrite posts to follow instructions precisely and return ONLY the rewritten text, with no preamble, explanations, or quotes.',
        },
        {
          role: 'user',
          content: `Rewrite the following social media post for ${platform}.
Original Post:
"""
${originalContent}
"""

Instruction:
${instruction}

Remember:
- Return ONLY the rewritten post. No explanations, no markdown block wrappers, no quotes.
- Respect the platform character limit of ${limit} characters.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`DeepSeek API error ${response.status}: ${err}`)
  }

  const data = await response.json()
  let rewritten = data.choices?.[0]?.message?.content?.trim()

  if (!rewritten) throw new Error('Empty response from DeepSeek')

  // Clean up any surrounding quotes if returned by the model
  if (rewritten.startsWith('"') && rewritten.endsWith('"')) {
    rewritten = rewritten.slice(1, -1).trim()
  }

  // Enforce limit
  if (rewritten.length > limit) {
    rewritten = rewritten.slice(0, limit - 1).trimEnd() + '…'
  }

  return rewritten
}
