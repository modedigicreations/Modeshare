/**
 * Twitter / X API v2 Client Library
 * Handles OAuth 2.0 PKCE authentication, token management, tweet publishing, and metrics
 */

export interface TwitterUser {
  id: string
  name: string
  username: string
}

export interface TwitterPostMetrics {
  reactions: number // likes
  clicks: number // url clicks / impressions
  reposts: number // retweets / reposts
  comments: number // replies
}

/**
 * Resolve canonical Twitter OAuth 2.0 redirect URI
 */
export function resolveTwitterRedirectUri(requestOrigin?: string): string {
  let redirectUri = (process.env.TWITTER_REDIRECT_URI || '').trim()
  if (redirectUri) return redirectUri

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '')
  if (appUrl) {
    let canonical = appUrl
    if (!canonical.includes('localhost') && !canonical.includes('127.0.0.1')) {
      canonical = canonical.replace(/^http:\/\//i, 'https://')
    }
    return `${canonical}/api/twitter/callback`
  }

  if (requestOrigin) {
    let origin = requestOrigin.trim().replace(/\/+$/, '')
    if (!origin.includes('localhost') && !origin.includes('127.0.0.1')) {
      origin = origin.replace(/^http:\/\//i, 'https://')
    }
    return `${origin}/api/twitter/callback`
  }

  return 'https://modeshare.net/api/twitter/callback'
}

/**
 * Generate Twitter OAuth 2.0 authorization URL with PKCE
 */
export function getTwitterAuthUrl(
  state: string,
  codeChallenge: string,
  requestOrigin?: string
): string {
  const clientId = (process.env.TWITTER_CLIENT_ID || process.env.NEXT_PUBLIC_TWITTER_CLIENT_ID || '').trim()
  const redirectUri = resolveTwitterRedirectUri(requestOrigin)

  const scopes = [
    'tweet.read',
    'tweet.write',
    'users.read',
    'offline.access',
  ].join(' ')

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  return `https://twitter.com/i/oauth2/authorize?${params.toString()}`
}

/**
 * Exchange OAuth 2.0 authorization code with PKCE code_verifier for tokens
 */
export async function exchangeTwitterCode(
  code: string,
  codeVerifier: string,
  requestOrigin?: string
): Promise<{
  accessToken: string
  refreshToken?: string
  expiresIn?: number
  user: TwitterUser
}> {
  const clientId = (process.env.TWITTER_CLIENT_ID || '').trim()
  const clientSecret = (process.env.TWITTER_CLIENT_SECRET || '').trim()
  const redirectUri = resolveTwitterRedirectUri(requestOrigin)

  if (!clientId) {
    throw new Error('TWITTER_CLIENT_ID is not configured')
  }

  const tokenUrl = 'https://api.twitter.com/2/oauth2/token'
  const bodyParams = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  })

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  }

  // If confidential client with client secret, send Basic auth header
  if (clientSecret) {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    headers['Authorization'] = `Basic ${basicAuth}`
  }

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers,
    body: bodyParams.toString(),
  })

  if (!res.ok) {
    const errText = await res.text()
    let msg = errText
    try {
      const parsed = JSON.parse(errText)
      if (parsed.error_description || parsed.error) {
        msg = parsed.error_description || parsed.error
      }
    } catch {}
    throw new Error(`Twitter token exchange failed: ${msg}`)
  }

  const data = await res.json()
  const accessToken = data.access_token
  if (!accessToken) {
    throw new Error('No access_token returned by Twitter API')
  }

  // Fetch authenticated user profile
  const user = await resolveTwitterConnection(accessToken)

  return {
    accessToken,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    user,
  }
}

/**
 * Refresh an expired Twitter OAuth 2.0 access token
 */
export async function refreshTwitterToken(
  refreshToken: string
): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn: number
}> {
  const clientId = (process.env.TWITTER_CLIENT_ID || '').trim()
  const clientSecret = (process.env.TWITTER_CLIENT_SECRET || '').trim()

  if (!clientId) {
    throw new Error('TWITTER_CLIENT_ID is not configured')
  }

  const tokenUrl = 'https://api.twitter.com/2/oauth2/token'
  const bodyParams = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  })

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  }

  if (clientSecret) {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    headers['Authorization'] = `Basic ${basicAuth}`
  }

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers,
    body: bodyParams.toString(),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Failed to refresh Twitter token: ${errText}`)
  }

  const data = await res.json()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresIn: data.expires_in || 7200,
  }
}

/**
 * Resolve and validate a Twitter user profile from access token
 */
export async function resolveTwitterConnection(accessToken: string): Promise<TwitterUser> {
  const cleanToken = accessToken.trim()
  const url = 'https://api.twitter.com/2/users/me?user.fields=profile_image_url,description'

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${cleanToken}`,
    },
  })

  if (!res.ok) {
    const errText = await res.text()
    let msg = errText
    try {
      const parsed = JSON.parse(errText)
      if (parsed.detail || parsed.title) {
        msg = parsed.detail || parsed.title
      }
    } catch {}
    throw new Error(`Invalid Twitter Access Token: ${msg}`)
  }

  const data = await res.json()
  if (!data.data?.id) {
    throw new Error('Could not retrieve Twitter user profile')
  }

  return {
    id: data.data.id,
    name: data.data.name || 'Twitter User',
    username: data.data.username || '',
  }
}

/**
 * Publish a Tweet directly to Twitter / X via API v2
 */
export async function postTweet(
  accessToken: string,
  text: string
): Promise<{ id: string; text: string }> {
  const cleanToken = accessToken.trim()
  const url = 'https://api.twitter.com/2/tweets'

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cleanToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  })

  if (!res.ok) {
    const errText = await res.text()
    let msg = errText
    try {
      const parsed = JSON.parse(errText)
      if (parsed.detail || parsed.title) {
        msg = parsed.detail || parsed.title
      }
    } catch {}
    throw new Error(`Twitter post failed: ${msg}`)
  }

  const data = await res.json()
  if (!data.data?.id) {
    throw new Error('Twitter returned no tweet ID')
  }

  return {
    id: data.data.id,
    text: data.data.text || text,
  }
}

/**
 * Fetch public metrics for a tweet
 */
export async function getTwitterPostMetrics(
  accessToken: string,
  tweetId: string
): Promise<TwitterPostMetrics> {
  const cleanToken = accessToken.trim()
  const url = `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=public_metrics`

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${cleanToken}`,
    },
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Twitter metrics fetch failed: ${errText}`)
  }

  const data = await res.json()
  const metrics = data.data?.public_metrics || {}

  return {
    reactions: metrics.like_count || 0,
    clicks: metrics.impression_count || 0,
    reposts: metrics.retweet_count || 0,
    comments: metrics.reply_count || 0,
  }
}
