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
  const clientId = (process.env.FACEBOOK_APP_ID || process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || '948046124459514').trim()
  const redirectUri = resolveFacebookRedirectUri(requestOrigin)
  const configId = (explicitConfigId || process.env.FACEBOOK_CONFIG_ID || process.env.NEXT_PUBLIC_FACEBOOK_CONFIG_ID || '1615779169941437').trim()

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
  const clientId = (process.env.FACEBOOK_APP_ID || process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || '948046124459514').trim()
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
  const clientId = (process.env.FACEBOOK_APP_ID || process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || '948046124459514').trim()
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
 * Inspect, upgrade, and resolve Facebook Page(s) from either:
 * 1. A User Access Token (short-lived or long-lived) -> upgrades & fetches managed pages and permanent page tokens
 * 2. A Direct Page Access Token (e.g. from System User / Business Suite) -> directly validates the page
 */
export async function resolveFacebookConnection(
  token: string,
  explicitAppSecret?: string,
  explicitTargetPageId?: string
): Promise<{
  pages: FacebookPage[]
  isDirectPageToken: boolean
  tokenType: 'user' | 'page'
  userToken: string
}> {
  const cleanToken = token.trim()
  const appSecret = (explicitAppSecret || process.env.FACEBOOK_APP_SECRET || '').trim()

  // 1. If an explicit Target Page ID is provided, query it directly
  let targetPageErrorDetails = ''
  if (explicitTargetPageId && explicitTargetPageId.trim()) {
    const cleanTargetId = explicitTargetPageId.trim()
    try {
      // Try with access_token and category fields first
      let targetUrl = new URL(`${FB_GRAPH_BASE}/${cleanTargetId}`)
      targetUrl.searchParams.set('access_token', cleanToken)
      targetUrl.searchParams.set('fields', 'id,name,access_token,category')
      let targetRes = await fetch(targetUrl.toString(), { method: 'GET' })
      let targetData = targetRes.ok ? await targetRes.json() : null

      // Fallback to simpler fields if access_token or category are restricted
      if (!targetData?.id) {
        targetUrl = new URL(`${FB_GRAPH_BASE}/${cleanTargetId}`)
        targetUrl.searchParams.set('access_token', cleanToken)
        targetUrl.searchParams.set('fields', 'id,name,category')
        targetRes = await fetch(targetUrl.toString(), { method: 'GET' })
        if (targetRes.ok) targetData = await targetRes.json()
      }

      if (!targetData?.id) {
        targetUrl = new URL(`${FB_GRAPH_BASE}/${cleanTargetId}`)
        targetUrl.searchParams.set('access_token', cleanToken)
        targetUrl.searchParams.set('fields', 'id,name')
        targetRes = await fetch(targetUrl.toString(), { method: 'GET' })
        if (targetRes.ok) targetData = await targetRes.json()
      }

      if (targetData?.id) {
        return {
          pages: [
            {
              id: targetData.id,
              name: targetData.name || 'Facebook Page',
              access_token: targetData.access_token || cleanToken,
              category: targetData.category,
            },
          ],
          isDirectPageToken: !targetData.access_token,
          tokenType: 'page',
          userToken: cleanToken,
        }
      } else {
        const errText = await targetRes.text()
        let errMsg = errText
        try {
          const parsed = JSON.parse(errText)
          if (parsed.error?.message) errMsg = parsed.error.message
        } catch {}
        targetPageErrorDetails = errMsg
        console.warn(`Target page (${cleanTargetId}) query failed: ${errMsg}`)
      }
    } catch (targetErr) {
      console.warn('Target page query error:', targetErr)
    }
  }

  // 2. Query /me to inspect the token node (only query universally supported fields on /me)
  const meUrl = new URL(`${FB_GRAPH_BASE}/me`)
  meUrl.searchParams.set('access_token', cleanToken)
  meUrl.searchParams.set('fields', 'id,name')

  const meRes = await fetch(meUrl.toString(), { method: 'GET' })
  if (!meRes.ok) {
    const errText = await meRes.text()
    let msg = errText
    try {
      const json = JSON.parse(errText)
      if (json.error?.message) msg = json.error.message
    } catch {}
    throw new Error(`Invalid Facebook Access Token: ${msg}`)
  }

  const meData = await meRes.json()

  // 3. Strategy A: Standard User Managed Pages (/me/accounts)
  try {
    const accountsUrl = new URL(`${FB_GRAPH_BASE}/me/accounts`)
    accountsUrl.searchParams.set('access_token', cleanToken)
    accountsUrl.searchParams.set('fields', 'id,name,access_token,category')

    const accountsRes = await fetch(accountsUrl.toString(), { method: 'GET' })
    const accountsData = accountsRes.ok ? await accountsRes.json() : null

    if (accountsData && Array.isArray(accountsData.data) && accountsData.data.length > 0) {
      let longLivedUserToken = cleanToken
      if (appSecret) {
        try {
          longLivedUserToken = await upgradeToLongLivedToken(cleanToken)
          const upgradedAccountsUrl = new URL(`${FB_GRAPH_BASE}/me/accounts`)
          upgradedAccountsUrl.searchParams.set('access_token', longLivedUserToken)
          upgradedAccountsUrl.searchParams.set('fields', 'id,name,access_token,category')
          const upgradedRes = await fetch(upgradedAccountsUrl.toString(), { method: 'GET' })
          if (upgradedRes.ok) {
            const upgradedData = await upgradedRes.json()
            if (Array.isArray(upgradedData.data) && upgradedData.data.length > 0) {
              return {
                pages: upgradedData.data.map((acc: { id: string; name: string; access_token: string; category?: string }) => ({
                  id: acc.id,
                  name: acc.name,
                  access_token: acc.access_token,
                  category: acc.category,
                })),
                isDirectPageToken: false,
                tokenType: 'user',
                userToken: longLivedUserToken,
              }
            }
          }
        } catch (upgradeErr) {
          console.warn('Long-lived token upgrade warning:', upgradeErr)
        }
      }

      return {
        pages: accountsData.data.map((acc: { id: string; name: string; access_token: string; category?: string }) => ({
          id: acc.id,
          name: acc.name,
          access_token: acc.access_token,
          category: acc.category,
        })),
        isDirectPageToken: false,
        tokenType: 'user',
        userToken: cleanToken,
      }
    }
  } catch (err) {
    console.warn('/me/accounts query error:', err)
  }

  // 4. Strategy B: Meta Business System User Assigned Pages (/me/assigned_pages)
  try {
    const assignedUrl = new URL(`${FB_GRAPH_BASE}/me/assigned_pages`)
    assignedUrl.searchParams.set('access_token', cleanToken)
    assignedUrl.searchParams.set('fields', 'id,name,access_token,category')

    const assignedRes = await fetch(assignedUrl.toString(), { method: 'GET' })
    const assignedData = assignedRes.ok ? await assignedRes.json() : null

    if (assignedData && Array.isArray(assignedData.data) && assignedData.data.length > 0) {
      return {
        pages: assignedData.data.map((acc: { id: string; name: string; access_token: string; category?: string }) => ({
          id: acc.id,
          name: acc.name,
          access_token: acc.access_token || cleanToken,
          category: acc.category,
        })),
        isDirectPageToken: false,
        tokenType: 'user',
        userToken: cleanToken,
      }
    }
  } catch (err) {
    console.warn('/me/assigned_pages query error:', err)
  }

  // 5. Strategy C: Check known default page (Dailymedia Nigeria: 419025421864993)
  try {
    let defaultPageUrl = new URL(`${FB_GRAPH_BASE}/419025421864993`)
    defaultPageUrl.searchParams.set('access_token', cleanToken)
    defaultPageUrl.searchParams.set('fields', 'id,name,access_token,category')
    let defRes = await fetch(defaultPageUrl.toString(), { method: 'GET' })
    let defData = defRes.ok ? await defRes.json() : null

    if (!defData?.id) {
      defaultPageUrl = new URL(`${FB_GRAPH_BASE}/419025421864993`)
      defaultPageUrl.searchParams.set('access_token', cleanToken)
      defaultPageUrl.searchParams.set('fields', 'id,name')
      defRes = await fetch(defaultPageUrl.toString(), { method: 'GET' })
      if (defRes.ok) defData = await defRes.json()
    }

    if (defData?.id) {
      return {
        pages: [
          {
            id: defData.id,
            name: defData.name || 'Dailymedia Nigeria',
            access_token: defData.access_token || cleanToken,
            category: defData.category,
          },
        ],
        isDirectPageToken: !defData.access_token,
        tokenType: 'page',
        userToken: cleanToken,
      }
    }
  } catch {}

  // If this is a System User or User account with no pages discovered, provide a clear actionable error
  const nodeName = meData.name || 'System User / User'
  const nodeId = meData.id || ''
  const details = targetPageErrorDetails ? ` Meta API response: "${targetPageErrorDetails}".` : ''
  throw new Error(
    `Connected to Meta account "${nodeName}" (${nodeId}), but no Facebook Page was found.${details} ` +
    `Please ensure your Facebook Page is assigned under Meta Business Settings > Users > System Users > Assigned Assets, ` +
    `and generate a new token after assigning the asset.`
  )
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
  // 1. Resolve actual Page Access Token if a user/system token was provided
  let effectiveToken = pageAccessToken
  try {
    const pageTokenUrl = new URL(`${FB_GRAPH_BASE}/${pageId}`)
    pageTokenUrl.searchParams.set('fields', 'access_token')
    pageTokenUrl.searchParams.set('access_token', pageAccessToken)
    const pageTokenRes = await fetch(pageTokenUrl.toString(), { method: 'GET' })
    if (pageTokenRes.ok) {
      const pageTokenData = await pageTokenRes.json()
      if (pageTokenData.access_token) {
        effectiveToken = pageTokenData.access_token
      }
    }
  } catch (resolveErr) {
    console.warn('Page token pre-fetch warning:', resolveErr)
  }

  const url = `${FB_GRAPH_BASE}/${pageId}/feed`
  const bodyParams: Record<string, string> = {
    message: content,
    access_token: effectiveToken,
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

  let res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(bodyParams).toString(),
  })

  // If first attempt failed with permission error and we have an original token, try fallback
  if (!res.ok && effectiveToken !== pageAccessToken) {
    bodyParams.access_token = pageAccessToken
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(bodyParams).toString(),
    })
  }

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
