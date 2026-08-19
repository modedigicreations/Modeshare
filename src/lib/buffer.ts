import { Platform } from '@/types/database'

const BUFFER_API = 'https://api.bufferapp.com/1'

export interface BufferProfile {
  id: string
  service: string  // 'facebook' | 'twitter' | 'linkedin_page' etc
  service_username: string
  formatted_service: string
}

export interface BufferUpdateResponse {
  success: boolean
  buffer_count: number
  buffer_percentage: number
  updates: {
    id: string
    status: string
    text: string
    profile_id: string
    scheduled_at?: number
  }[]
}

/**
 * Fetch all connected Buffer profiles for a given access token
 */
export async function getBufferProfiles(accessToken: string): Promise<BufferProfile[]> {
  const res = await fetch(`${BUFFER_API}/profiles.json?access_token=${accessToken}`)
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Buffer profiles fetch failed: ${err}`)
  }
  return res.json()
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
 * Schedule a post to Buffer
 */
export async function scheduleBufferPost(
  accessToken: string,
  profileId: string,
  content: string,
  scheduledAt?: string | null
): Promise<string> {
  const body = new URLSearchParams({
    access_token: accessToken,
    'profile_ids[]': profileId,
    text: content,
  })

  if (scheduledAt) {
    const timestamp = Math.floor(new Date(scheduledAt).getTime() / 1000)
    body.append('scheduled_at', timestamp.toString())
  } else {
    // Add to the end of the queue
    body.append('now', 'false')
  }

  const res = await fetch(`${BUFFER_API}/updates/create.json`, {
    method: 'POST',
    body,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Buffer schedule failed: ${err}`)
  }

  const data: BufferUpdateResponse = await res.json()

  if (!data.success || !data.updates?.[0]?.id) {
    throw new Error('Buffer returned no update ID')
  }

  return data.updates[0].id
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
export function getBufferAuthUrl(challenge: string): string {
  const params = new URLSearchParams({
    client_id: (process.env.BUFFER_CLIENT_ID || '').trim(),
    redirect_uri: (process.env.BUFFER_REDIRECT_URI || '').trim(),
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    scope: 'account:read posts:read posts:write',
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
