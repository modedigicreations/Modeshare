/**
 * LinkedIn API Client Library
 * Handles LinkedIn OAuth 2.0, Company Page / Member profile resolution, Post publishing, and metrics
 */

export interface LinkedInAccountOption {
  id: string // full URN, e.g. "urn:li:organization:123456" or "urn:li:person:abcdef"
  name: string
  type: 'organization' | 'person'
  vanityName?: string
}

export interface LinkedInPostMetrics {
  reactions: number
  clicks: number
  reposts: number
  comments: number
}

const LINKEDIN_API_VERSION = '202401'

/**
 * Resolve canonical LinkedIn OAuth 2.0 redirect URI
 */
export function resolveLinkedInRedirectUri(requestOrigin?: string): string {
  let redirectUri = (process.env.LINKEDIN_REDIRECT_URI || '').trim()
  if (redirectUri) return redirectUri

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '')
  if (appUrl) {
    let canonical = appUrl
    if (!canonical.includes('localhost') && !canonical.includes('127.0.0.1')) {
      canonical = canonical.replace(/^http:\/\//i, 'https://')
    }
    return `${canonical}/api/linkedin/callback`
  }

  if (requestOrigin) {
    let origin = requestOrigin.trim().replace(/\/+$/, '')
    if (!origin.includes('localhost') && !origin.includes('127.0.0.1')) {
      origin = origin.replace(/^http:\/\//i, 'https://')
    }
    return `${origin}/api/linkedin/callback`
  }

  return 'https://modeshare.net/api/linkedin/callback'
}

/**
 * Generate LinkedIn OAuth 2.0 authorization URL
 */
export function getLinkedInAuthUrl(state: string, requestOrigin?: string): string {
  const clientId = (process.env.LINKEDIN_CLIENT_ID || process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID || '').trim()
  const redirectUri = resolveLinkedInRedirectUri(requestOrigin)

  const scopes = [
    'openid',
    'profile',
    'w_member_social',
    'w_organization_social',
    'r_organization_social',
  ].join(' ')

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: scopes,
  })

  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`
}

/**
 * Exchange OAuth 2.0 authorization code for tokens
 */
export async function exchangeLinkedInCode(
  code: string,
  requestOrigin?: string
): Promise<{
  accessToken: string
  refreshToken?: string
  expiresIn?: number
}> {
  const clientId = (process.env.LINKEDIN_CLIENT_ID || '').trim()
  const clientSecret = (process.env.LINKEDIN_CLIENT_SECRET || '').trim()
  const redirectUri = resolveLinkedInRedirectUri(requestOrigin)

  if (!clientId || !clientSecret) {
    throw new Error('LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET is not configured')
  }

  const tokenUrl = 'https://www.linkedin.com/oauth/v2/accessToken'
  const bodyParams = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  })

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: bodyParams.toString(),
  })

  if (!res.ok) {
    const errText = await res.text()
    let msg = errText
    try {
      const parsed = JSON.parse(errText)
      if (parsed.error_description || parsed.message) {
        msg = parsed.error_description || parsed.message
      }
    } catch {}
    throw new Error(`LinkedIn token exchange failed: ${msg}`)
  }

  const data = await res.json()
  const accessToken = data.access_token
  if (!accessToken) {
    throw new Error('No access_token returned by LinkedIn')
  }

  return {
    accessToken,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  }
}

/**
 * Fetch all LinkedIn Company Pages and personal profile accessible with this token
 */
export async function getLinkedInPages(accessToken: string): Promise<LinkedInAccountOption[]> {
  const cleanToken = accessToken.trim()
  const accounts: LinkedInAccountOption[] = []

  // 1. Fetch personal profile identity (OpenID userinfo)
  try {
    const userinfoRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${cleanToken}` },
    })
    if (userinfoRes.ok) {
      const userData = await userinfoRes.json()
      if (userData.sub) {
        accounts.push({
          id: `urn:li:person:${userData.sub}`,
          name: userData.name || `${userData.given_name || ''} ${userData.family_name || ''}`.trim() || 'LinkedIn Profile',
          type: 'person',
        })
      }
    }
  } catch (err) {
    console.warn('LinkedIn userinfo fetch warning:', err)
  }

  // 2. Fetch organizational pages (Company Pages)
  try {
    const aclsUrl = 'https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee&state=APPROVED'
    const aclsRes = await fetch(aclsUrl, {
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    })

    if (aclsRes.ok) {
      const aclsData = await aclsRes.json()
      if (Array.isArray(aclsData.elements)) {
        for (const element of aclsData.elements) {
          const orgUrn = element.organizationalTarget
          if (orgUrn && !accounts.some((a) => a.id === orgUrn)) {
            // Fetch organization details (name)
            let orgName = 'LinkedIn Company Page'
            try {
              const orgId = orgUrn.replace('urn:li:organization:', '').replace('urn:li:organizationBrand:', '')
              const orgDetailsRes = await fetch(`https://api.linkedin.com/v2/organizations/${orgId}`, {
                headers: {
                  Authorization: `Bearer ${cleanToken}`,
                  'X-Restli-Protocol-Version': '2.0.0',
                },
              })
              if (orgDetailsRes.ok) {
                const orgDetails = await orgDetailsRes.json()
                if (orgDetails.localizedName) {
                  orgName = orgDetails.localizedName
                }
              }
            } catch {}

            accounts.push({
              id: orgUrn,
              name: orgName,
              type: 'organization',
            })
          }
        }
      }
    }
  } catch (orgErr) {
    console.warn('LinkedIn organizational ACLs query warning:', orgErr)
  }

  return accounts
}

/**
 * Validate token and resolve default / specified target LinkedIn account (Organization or Person)
 */
export async function resolveLinkedInConnection(
  accessToken: string,
  explicitAccountId?: string
): Promise<{
  accounts: LinkedInAccountOption[]
  selectedAccount: LinkedInAccountOption
}> {
  const cleanToken = accessToken.trim()
  const accounts = await getLinkedInPages(cleanToken)

  if (explicitAccountId && explicitAccountId.trim()) {
    const rawId = explicitAccountId.trim()
    const formattedUrn = rawId.startsWith('urn:li:')
      ? rawId
      : /^\d+$/.test(rawId)
        ? `urn:li:organization:${rawId}`
        : `urn:li:person:${rawId}`

    const found = accounts.find((a) => a.id === formattedUrn || a.id.includes(rawId))
    if (found) {
      return { accounts, selectedAccount: found }
    }

    // Direct organization resolution
    const directAccount: LinkedInAccountOption = {
      id: formattedUrn,
      name: formattedUrn.includes('organization') ? 'LinkedIn Organization' : 'LinkedIn Profile',
      type: formattedUrn.includes('organization') ? 'organization' : 'person',
    }
    return { accounts: [directAccount, ...accounts], selectedAccount: directAccount }
  }

  if (accounts.length === 0) {
    // If endpoints couldn't return accounts, verify token via userinfo
    try {
      const userinfoRes = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${cleanToken}` },
      })
      if (userinfoRes.ok) {
        const userData = await userinfoRes.json()
        const profileAccount: LinkedInAccountOption = {
          id: `urn:li:person:${userData.sub}`,
          name: userData.name || 'LinkedIn Member',
          type: 'person',
        }
        return { accounts: [profileAccount], selectedAccount: profileAccount }
      }
    } catch {}

    throw new Error('Invalid LinkedIn Access Token or no LinkedIn profile/organization found.')
  }

  // Prefer organization page over personal profile if available
  const preferred = accounts.find((a) => a.type === 'organization') || accounts[0]
  return { accounts, selectedAccount: preferred }
}

/**
 * Publish a Post directly to LinkedIn (Organization or Member) via Posts REST API
 */
export async function postLinkedInShare(
  accessToken: string,
  authorUrn: string,
  text: string
): Promise<{ id: string }> {
  const cleanToken = accessToken.trim()
  const cleanAuthor = authorUrn.startsWith('urn:li:') ? authorUrn : `urn:li:organization:${authorUrn}`

  // Strategy A: LinkedIn Versioned Posts REST API (Recommended)
  const restUrl = 'https://api.linkedin.com/rest/posts'
  const restBody = {
    author: cleanAuthor,
    commentary: text,
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  }

  let res = await fetch(restUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cleanToken}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': LINKEDIN_API_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(restBody),
  })

  // If 201 Created, post ID is in x-restli-id or x-linkedin-id header
  if (res.status === 201 || res.ok) {
    const postId = res.headers.get('x-restli-id') || res.headers.get('x-linkedin-id')
    if (postId) {
      return { id: postId }
    }
    try {
      const json = await res.json()
      if (json.id) return { id: json.id }
    } catch {}
    return { id: `urn:li:share:${Date.now()}` }
  }

  // Strategy B: Fallback to /v2/ugcPosts
  const ugcUrl = 'https://api.linkedin.com/v2/ugcPosts'
  const ugcBody = {
    author: cleanAuthor,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: {
          text,
        },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  }

  const ugcRes = await fetch(ugcUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cleanToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(ugcBody),
  })

  if (ugcRes.ok) {
    const ugcData = await ugcRes.json()
    if (ugcData.id) {
      return { id: ugcData.id }
    }
  }

  // If both failed, extract error message
  const errText = await res.text()
  let msg = errText
  try {
    const parsed = JSON.parse(errText)
    if (parsed.message) msg = parsed.message
  } catch {}
  throw new Error(`LinkedIn post failed: ${msg}`)
}

/**
 * Fetch public metrics for a LinkedIn post
 */
export async function getLinkedInPostMetrics(
  accessToken: string,
  postId: string
): Promise<LinkedInPostMetrics> {
  const cleanToken = accessToken.trim()
  const encodedPostId = encodeURIComponent(postId)
  const url = `https://api.linkedin.com/v2/socialActions/${encodedPostId}`

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${cleanToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
    },
  })

  if (!res.ok) {
    return { reactions: 0, clicks: 0, reposts: 0, comments: 0 }
  }

  const data = await res.json()
  return {
    reactions: data.likesSummary?.totalLikes || 0,
    clicks: 0,
    reposts: 0,
    comments: data.commentsSummary?.totalComments || 0,
  }
}
