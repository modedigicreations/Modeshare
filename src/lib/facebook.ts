const FB_GRAPH_VERSION = 'v19.0'
const FB_GRAPH_BASE = `https://graph.facebook.com/${FB_GRAPH_VERSION}`

export interface FacebookPage {
  id: string
  name: string
  access_token: string
  category?: string
}

export interface FacebookPostMetrics {
  reactions: number
  clicks: number
  reposts: number
  comments: number
}

/**
 * Resolve the canonical Facebook OAuth redirect URI ensuring HTTPS in production
 */
export function resolveFacebookRedirectUri(requestOrigin?: string): string {
  let redirectUri = (process.env.FACEBOOK_REDIRECT_URI || '').trim()
  if (redirectUri) {
    return redirectUri
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '')
  if (appUrl) {
    let canonical = appUrl
    if (!canonical.includes('localhost') && !canonical.includes('127.0.0.1')) {
      canonical = canonical.replace(/^http:\/\//i, 'https://')
    }
    return `${canonical}/api/facebook/callback`
  }

  if (requestOrigin) {
    let origin = requestOrigin.trim().replace(/\/+$/, '')
    if (!origin.includes('localhost') && !origin.includes('127.0.0.1')) {
      origin = origin.replace(/^http:\/\//i, 'https://')
    }
    return `${origin}/api/facebook/callback`
  }

  return 'https://modeshare.net/api/facebook/callback'
}

/**
 * Generate Facebook OAuth authorization URL
 */
export function getFacebookAuthUrl(state: string, requestOrigin?: string, explicitConfigId?: string): string {
  const clientId = (process.env.FACEBOOK_APP_ID || process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || '').trim()
  const redirectUri = resolveFacebookRedirectUri(requestOrigin)
  const configId = (explicitConfigId || process.env.FACEBOOK_CONFIG_ID || process.env.NEXT_PUBLIC_FACEBOOK_CONFIG_ID || '').trim()

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    response_type: 'code',
  })

  if (configId) {
    params.set('config_id', configId)
  } else {
    const scopes = [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'public_profile',
    ].join(',')
    params.set('scope', scopes)
  }

  return `https://www.facebook.com/${FB_GRAPH_VERSION}/dialog/oauth?${params.toString()}`
}


/**
 * Upgrade short-lived token to long-lived 60-day token
 */
export async function upgradeToLongLivedToken(shortLivedToken: string): Promise<string> {
  const clientId = (process.env.FACEBOOK_APP_ID || process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || '').trim()
  const clientSecret = (process.env.FACEBOOK_APP_SECRET || '').trim()

  if (!clientId || !clientSecret) {
    return shortLivedToken
  }

  const exchangeUrl = new URL(`${FB_GRAPH_BASE}/oauth/access_token`)
  exchangeUrl.searchParams.set('grant_type', 'fb_exchange_token')
  exchangeUrl.searchParams.set('client_id', clientId)
  exchangeUrl.searchParams.set('client_secret', clientSecret)
  exchangeUrl.searchParams.set('fb_exchange_token', shortLivedToken)

  const longLivedRes = await fetch(exchangeUrl.toString(), { method: 'GET' })
  if (!longLivedRes.ok) {
    return shortLivedToken
  }

  const longLivedData = await longLivedRes.json()
  return longLivedData.access_token || shortLivedToken
}

/**
 * Exchange auth code for user access token and upgrade to a long-lived user token (60-day expiry)
 */
export async function exchangeFacebookCode(code: string, requestOrigin?: string): Promise<string> {
  const clientId = (process.env.FACEBOOK_APP_ID || process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || '').trim()
  const clientSecret = (process.env.FACEBOOK_APP_SECRET || '').trim()
  const redirectUri = resolveFacebookRedirectUri(requestOrigin)

  if (!clientId || !clientSecret) {
    throw new Error('Facebook App credentials (FACEBOOK_APP_ID, FACEBOOK_APP_SECRET) are not configured')
  }

  // 1. Get short-lived token
  const tokenUrl = new URL(`${FB_GRAPH_BASE}/oauth/access_token`)
  tokenUrl.searchParams.set('client_id', clientId)
  tokenUrl.searchParams.set('client_secret', clientSecret)
  tokenUrl.searchParams.set('redirect_uri', redirectUri)
  tokenUrl.searchParams.set('code', code)

  const res = await fetch(tokenUrl.toString(), { method: 'GET' })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Facebook token exchange failed: ${err}`)
  }

  const data = await res.json()
  const shortLivedToken = data.access_token
  if (!shortLivedToken) {
    throw new Error('No access_token returned by Facebook')
  }

  // 2. Upgrade to long-lived token (60 days)
  return await upgradeToLongLivedToken(shortLivedToken)
}


/**
 * Fetch all Facebook Pages the user manages, with Page Access Tokens
 */
export async function getFacebookPages(userAccessToken: string): Promise<FacebookPage[]> {
  const url = new URL(`${FB_GRAPH_BASE}/me/accounts`)
  url.searchParams.set('access_token', userAccessToken)
  url.searchParams.set('fields', 'id,name,access_token,category')

  const res = await fetch(url.toString(), { method: 'GET' })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to fetch Facebook Pages: ${err}`)
  }

  const result = await res.json()
  if (result.error) {
    throw new Error(`Facebook API error: ${result.error.message || 'Failed to fetch pages'}`)
  }

  const accounts = result.data || []
  return accounts.map((acc: { id: string; name: string; access_token: string; category?: string }) => ({
    id: acc.id,
    name: acc.name,
    access_token: acc.access_token,
    category: acc.category,
  }))
}

/**
 * Schedule or publish a post to a Facebook Page feed
 * 
 * Note: Facebook Page post scheduling requires scheduled_publish_time to be between
 * 10 minutes (600s) and 75 days in the future. If scheduledAt is within 10 minutes or in the past,
 * it publishes immediately.
 */
export async function scheduleFacebookPost(
  pageAccessToken: string,
  pageId: string,
  content: string,
  scheduledAt?: string | null
): Promise<{ id: string; isScheduled: boolean }> {
  const url = `${FB_GRAPH_BASE}/${pageId}/feed`
  const bodyParams: Record<string, string> = {
    message: content,
    access_token: pageAccessToken,
  }

  let isScheduled = false
  if (scheduledAt) {
    const scheduledTime = new Date(scheduledAt).getTime()
    const now = Date.now()
    const diffSeconds = Math.floor((scheduledTime - now) / 1000)

    // Facebook requires scheduled_publish_time to be between 10 minutes and 75 days
    if (diffSeconds >= 600 && diffSeconds <= 75 * 24 * 3600) {
      bodyParams.published = 'false'
      bodyParams.scheduled_publish_time = Math.floor(scheduledTime / 1000).toString()
      isScheduled = true
    } else {
      // If time is less than 10 mins or in past, publish immediately
      bodyParams.published = 'true'
      isScheduled = false
    }
  } else {
    bodyParams.published = 'true'
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(bodyParams).toString(),
  })

  if (!res.ok) {
    const err = await res.text()
    let parsedMsg = err
    try {
      const json = JSON.parse(err)
      if (json.error?.message) {
        parsedMsg = json.error.message
      }
    } catch {
      // keep raw err
    }
    throw new Error(`Facebook post failed: ${parsedMsg}`)
  }

  const data = await res.json()
  if (!data.id) {
    throw new Error('Facebook returned no post ID')
  }

  return { id: data.id, isScheduled }
}

/**
 * Fetch post metrics/insights from Facebook Graph API
 */
export async function getFacebookPostMetrics(
  pageAccessToken: string,
  postId: string
): Promise<FacebookPostMetrics> {
  const url = new URL(`${FB_GRAPH_BASE}/${postId}`)
  url.searchParams.set('fields', 'reactions.summary(total_count),comments.summary(total_count),shares')
  url.searchParams.set('access_token', pageAccessToken)

  const res = await fetch(url.toString(), { method: 'GET' })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Facebook metrics fetch failed: ${err}`)
  }

  const data = await res.json()
  if (data.error) {
    throw new Error(`Facebook API error: ${data.error.message || 'Metrics error'}`)
  }

  const reactions = data.reactions?.summary?.total_count || 0
  const comments = data.comments?.summary?.total_count || 0
  const reposts = data.shares?.count || 0
  const clicks = 0 // Clicks require special Page Insights API permissions

  return {
    reactions,
    clicks,
    reposts,
    comments,
  }
}
