import { Platform } from '@/types/database'

export interface BufferProfile {
  id: string
  service: string  // 'facebook' | 'twitter' | 'linkedin_page' etc
  service_username: string
  formatted_service: string
}

/**
 * Fetch all connected Buffer profiles for a given access token using GraphQL API
 */
export async function getBufferProfiles(accessToken: string): Promise<BufferProfile[]> {
  // 1. Get organizations
  const orgsRes = await fetch('https://api.buffer.com', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      query: `
        query GetOrganizations {
          account {
            organizations {
              id
            }
          }
        }
      `
    }),
  })

  if (!orgsRes.ok) {
    const err = await orgsRes.text()
    throw new Error(`Buffer organizations fetch failed: ${err}`)
  }

  const orgsResult = await orgsRes.json()
  if (orgsResult.errors) {
    throw new Error(`Buffer GraphQL organizations error: ${orgsResult.errors[0]?.message || 'Unknown GraphQL error'}`)
  }

  const organizations = orgsResult.data?.account?.organizations || []
  const channels: BufferProfile[] = []

  // 2. Fetch channels for each organization
  for (const org of organizations) {
    const orgId = org.id
    if (!orgId) continue

    const channelsRes = await fetch('https://api.buffer.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query: `
          query GetChannels {
            channels(input: { organizationId: "${orgId}" }) {
              id
              name
              service
            }
          }
        `
      }),
    })

    if (!channelsRes.ok) {
      console.warn(`Failed to fetch channels for organization ${orgId}`)
      continue
    }

    const channelsResult = await channelsRes.json()
    if (channelsResult.errors) {
      console.warn(`Buffer channels error for organization ${orgId}:`, channelsResult.errors)
      continue
    }

    const orgChannels = channelsResult.data?.channels || []
    for (const ch of orgChannels) {
      channels.push({
        id: ch.id,
        service: ch.service,
        service_username: ch.name || '',
        formatted_service: ch.service,
      })
    }
  }

  return channels
}

/**
 * Map our Platform type to Buffer's service name
 */
const PLATFORM_TO_BUFFER_SERVICE: Record<Platform, string[]> = {
  facebook: ['facebook', 'facebook_page', 'facebook_group'],
  twitter: ['twitter'],
  linkedin: ['linkedin', 'linkedin_page'],
}

/**
 * Find the Buffer profile ID for a given platform
 */
export function findProfileId(
  profiles: BufferProfile[],
  platform: Platform
): string | null {
  const services = PLATFORM_TO_BUFFER_SERVICE[platform]
  const match = profiles.find((p) => services.includes(p.service.toLowerCase()))
  return match?.id || null
}

/**
 * Schedule a post to Buffer using GraphQL API
 */
export async function scheduleBufferPost(
  accessToken: string,
  profileId: string,
  content: string,
  scheduledAt?: string | null,
  platform?: string
): Promise<string> {
  const mutation = `
    mutation CreateBufferPost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess {
          post {
            id
          }
        }
        ... on MutationError {
          message
        }
      }
    }
  `

  const input: Record<string, unknown> = {
    text: content,
    channelId: profileId,
    schedulingType: 'automatic',
  }

  if (scheduledAt) {
    input.mode = 'customScheduled'
    input.dueAt = new Date(scheduledAt).toISOString()
  } else {
    input.mode = 'addToQueue'
  }

  if (platform === 'facebook') {
    input.metadata = {
      facebook: {
        type: 'post',
      },
    }
  } else if (platform === 'instagram') {
    input.metadata = {
      instagram: {
        type: 'post',
      },
    }
  }

  const res = await fetch('https://api.buffer.com', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      query: mutation,
      variables: { input },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Buffer GraphQL schedule failed: ${err}`)
  }

  const result = await res.json()
  if (result.errors) {
    throw new Error(`Buffer GraphQL error: ${result.errors[0]?.message || 'Unknown GraphQL error'}`)
  }

  const createPostData = result.data?.createPost
  if (createPostData?.message) {
    throw new Error(`Buffer scheduling error: ${createPostData.message}`)
  }

  const postId = createPostData?.post?.id
  if (!postId) {
    throw new Error('Buffer returned no post ID')
  }

  return postId
}

/**
 * Build the Buffer OAuth authorization URL
 */
import crypto from 'crypto'

export function generatePkce() {
  const verifier = crypto.randomBytes(32).toString('base64url')
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url')
  return { verifier, challenge }
}

/**
 * Build the Buffer OAuth authorization URL with PKCE challenge
 */
export function getBufferAuthUrl(challenge: string, state: string): string {
  const params = new URLSearchParams({
    client_id: (process.env.BUFFER_CLIENT_ID || '').trim(),
    redirect_uri: (process.env.BUFFER_REDIRECT_URI || '').trim(),
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    scope: 'account:read posts:read posts:write',
    state: state,
  })
  return `https://auth.buffer.com/auth?${params}`
}

/**
 * Exchange authorization code for access token using code verifier
 */
export async function exchangeBufferCode(code: string, codeVerifier: string): Promise<string> {
  const res = await fetch('https://auth.buffer.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: (process.env.BUFFER_CLIENT_ID || '').trim(),
      client_secret: (process.env.BUFFER_CLIENT_SECRET || '').trim(),
      redirect_uri: (process.env.BUFFER_REDIRECT_URI || '').trim(),
      code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Buffer token exchange failed: ${err}`)
  }

  const data = await res.json()
  return data.access_token
}

export async function getPostMetrics(
  accessToken: string,
  bufferPostId: string
): Promise<{ reactions: number; clicks: number; reposts: number; comments: number }> {
  const query = `
    query GetPostMetrics($input: PostInput!) {
      post(input: $input) {
        id
        metrics {
          type
          name
          value
          unit
        }
      }
    }
  `

  const res = await fetch('https://api.buffer.com', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      query,
      variables: { input: { id: bufferPostId } },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Buffer GraphQL metrics query failed: ${err}`)
  }

  const result = await res.json()
  if (result.errors) {
    throw new Error(`Buffer GraphQL error: ${result.errors[0]?.message || 'Unknown GraphQL error'}`)
  }

  const postData = result.data?.post
  const metrics = postData?.metrics || []

  const stats = {
    reactions: 0,
    clicks: 0,
    reposts: 0,
    comments: 0,
  }

  for (const m of metrics) {
    const val = Number(m.value) || 0
    if (m.type === 'reactions' || m.type === 'likes') {
      stats.reactions = val
    } else if (m.type === 'clicks') {
      stats.clicks = val
    } else if (m.type === 'reposts' || m.type === 'shares') {
      stats.reposts = val
    } else if (m.type === 'comments') {
      stats.comments = val
    }
  }

  return stats
}
