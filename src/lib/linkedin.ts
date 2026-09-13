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
  if (redirectUri && !redirectUri.includes('localhost:8080')) return redirectUri

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '')
  if (appUrl && !appUrl.includes('localhost:8080')) {
    let canonical = appUrl
    if (!canonical.includes('localhost') && !canonical.includes('127.0.0.1')) {
      canonical = canonical.replace(/^http:\/\//i, 'https://')
    }
    return `${canonical}/api/linkedin/callback`
  }

  if (requestOrigin && !requestOrigin.includes('localhost:8080')) {
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

  // Standard OpenID Connect + Share scopes (Sign In with LinkedIn using OpenID Connect + Share on LinkedIn)
  const configuredScopes = (process.env.LINKEDIN_SCOPES || '').trim()
  const scopes = configuredScopes || 'openid profile email w_member_social'

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

  // 1. Fetch personal profile identity via OpenID userinfo
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

  // 1b. Fallback to /v2/me for older/classic OAuth tokens
  if (accounts.length === 0) {
    try {
      const meRes = await fetch('https://api.linkedin.com/v2/me', {
        headers: { Authorization: `Bearer ${cleanToken}` },
      })
      if (meRes.ok) {
        const meData = await meRes.json()
        if (meData.id) {
          const fullName = `${meData.localizedFirstName || ''} ${meData.localizedLastName || ''}`.trim() || 'LinkedIn Member'
          accounts.push({
            id: `urn:li:person:${meData.id}`,
            name: fullName,
            type: 'person',
          })
        }
      }
    } catch (meErr) {
      console.warn('LinkedIn /v2/me fetch warning:', meErr)
    }
  }

  // 2. Fetch organizational pages (Company Pages)
  try {
    const aclsUrls = [
      'https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee&state=APPROVED',
      'https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee',
    ]

    for (const aclsUrl of aclsUrls) {
      const aclsRes = await fetch(aclsUrl, {
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
      })

      if (aclsRes.ok) {
        const aclsData = await aclsRes.json()
        if (Array.isArray(aclsData.elements) && aclsData.elements.length > 0) {
          for (const element of aclsData.elements) {
            const orgUrn = element.organizationalTarget
            if (orgUrn && !accounts.some((a) => a.id === orgUrn)) {
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
          break // Found pages successfully
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

  // If explicit account ID / Organization ID was provided, prioritize direct linkage
  if (explicitAccountId && explicitAccountId.trim()) {
    const rawId = explicitAccountId.trim()
    const formattedUrn = rawId.startsWith('urn:li:')
      ? rawId
      : /^\d+$/.test(rawId)
        ? `urn:li:organization:${rawId}`
        : `urn:li:person:${rawId}`

    // Try fetching page name if available
    let name = formattedUrn.includes('organization') ? `LinkedIn Organization (${rawId})` : `LinkedIn Member (${rawId})`
    try {
      if (formattedUrn.includes('organization')) {
        const orgId = formattedUrn.replace('urn:li:organization:', '').replace('urn:li:organizationBrand:', '')
        const orgDetailsRes = await fetch(`https://api.linkedin.com/v2/organizations/${orgId}`, {
          headers: {
            Authorization: `Bearer ${cleanToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
          },
        })
        if (orgDetailsRes.ok) {
          const orgDetails = await orgDetailsRes.json()
          if (orgDetails.localizedName) {
            name = orgDetails.localizedName
          }
        }
      }
    } catch {}

    const directAccount: LinkedInAccountOption = {
      id: formattedUrn,
      name,
      type: formattedUrn.includes('organization') ? 'organization' : 'person',
    }

    return {
      accounts: [directAccount],
      selectedAccount: directAccount,
    }
  }

  const accounts = await getLinkedInPages(cleanToken)

  if (accounts.length === 0) {
    const fallbackAcc: LinkedInAccountOption = {
      id: 'urn:li:person:me',
      name: 'LinkedIn Personal Profile',
      type: 'person',
    }
    accounts.push(fallbackAcc)
  }

  // Prefer organization page over personal profile if available
  const preferred = accounts.find((a) => a.type === 'organization') || accounts[0]
  return { accounts, selectedAccount: preferred }
}

/**
 * Publish a Post directly to LinkedIn (Organization or Member)
 * Tries modern REST API with active versions, fallback to /v2/ugcPosts, and fallback to member profile if org lacks scope
 */
export async function postLinkedInShare(
  accessToken: string,
  authorUrn: string,
  text: string
): Promise<{ id: string }> {
  const cleanToken = accessToken.trim()

  // Always resolve the real member URN first from /v2/userinfo
  let memberUrn: string | null = null
  let memberName: string | null = null
  try {
    const userinfoRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${cleanToken}` },
    })
    if (userinfoRes.ok) {
      const uData = await userinfoRes.json()
      if (uData.sub) {
        memberUrn = `urn:li:person:${uData.sub}`
        memberName = uData.name || `${uData.given_name || ''} ${uData.family_name || ''}`.trim()
      }
    }
  } catch {}

  if (!memberUrn) {
    try {
      const meRes = await fetch('https://api.linkedin.com/v2/me', {
        headers: { Authorization: `Bearer ${cleanToken}` },
      })
      if (meRes.ok) {
        const mData = await meRes.json()
        if (mData.id) memberUrn = `urn:li:person:${mData.id}`
      }
    } catch {}
  }

  // Resolve author URN options (primary target, plus personal member fallback)
  const authorsToTry: string[] = []
  if (authorUrn && authorUrn.trim()) {
    const raw = authorUrn.trim()
    if (raw === 'urn:li:person:me' || raw === 'me' || raw === 'person') {
      if (memberUrn) authorsToTry.push(memberUrn)
    } else {
      const formatted = raw.startsWith('urn:li:')
        ? raw
        : /^\d+$/.test(raw)
          ? `urn:li:organization:${raw}`
          : `urn:li:person:${raw}`
      authorsToTry.push(formatted)
    }
  }

  if (memberUrn && !authorsToTry.includes(memberUrn)) {
    authorsToTry.push(memberUrn)
  }

  if (authorsToTry.length === 0) {
    authorsToTry.push('urn:li:organization:74760541')
  }

  // Active LinkedIn REST API versions currently supported by LinkedIn
  const candidateVersions = [
    '202502',
    '202501',
    '202412',
    '202411',
    '202410',
    '202409',
    '202408',
    '202407',
    '202406',
    '202405',
    '202404',
    '202403',
  ]

  let lastError = ''

  for (const currentAuthor of authorsToTry) {
    // Strategy A: LinkedIn Modern REST API with minimal clean payload
    const isOrg = currentAuthor.includes('organization')
    const restUrl = 'https://api.linkedin.com/rest/posts'
    const restPayloads = [
      {
        author: currentAuthor,
        commentary: text,
        visibility: 'PUBLIC',
        lifecycleState: 'PUBLISHED',
      },
      {
        author: currentAuthor,
        commentary: text,
        visibility: 'PUBLIC',
        distribution: {
          feedDistribution: 'MAIN_FEED',
        },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
      },
    ]

    for (const restBody of restPayloads) {
      for (const version of candidateVersions) {
        try {
          const res = await fetch(restUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${cleanToken}`,
              'Content-Type': 'application/json',
              'LinkedIn-Version': version,
              'X-Restli-Protocol-Version': '2.0.0',
            },
            body: JSON.stringify(restBody),
          })

          if (res.status === 201 || res.ok) {
            const postId = res.headers.get('x-restli-id') || res.headers.get('x-linkedin-id')
            if (postId) return { id: postId }
            try {
              const json = await res.json()
              if (json.id) return { id: json.id }
            } catch {}
            return { id: `urn:li:share:${Date.now()}` }
          }

          const errText = await res.text()
          try {
            const parsed = JSON.parse(errText)
            lastError = parsed.message || errText
          } catch {
            lastError = errText
          }

          if (!lastError.toLowerCase().includes('not active') && !lastError.toLowerCase().includes('version')) {
            break // Version was accepted, error is due to author/permissions
          }
        } catch (fetchErr) {
          lastError = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
        }
      }
    }

    // Strategy B: Fallback to /v2/ugcPosts
    try {
      const ugcUrl = 'https://api.linkedin.com/v2/ugcPosts'
      const ugcBody = {
        author: currentAuthor,
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

      if (ugcRes.ok || ugcRes.status === 201) {
        const ugcData = await ugcRes.json()
        if (ugcData.id) return { id: ugcData.id }
        const ugcHeaderId = ugcRes.headers.get('x-restli-id') || ugcRes.headers.get('x-linkedin-id')
        if (ugcHeaderId) return { id: ugcHeaderId }
      } else {
        const ugcErrText = await ugcRes.text()
        try {
          const parsedUgc = JSON.parse(ugcErrText)
          if (parsedUgc.message) lastError = parsedUgc.message
        } catch {}
      }
    } catch (ugcErr) {
      console.warn('LinkedIn /v2/ugcPosts error:', ugcErr)
    }

    // Strategy C: Fallback to /v2/shares
    try {
      const sharesUrl = 'https://api.linkedin.com/v2/shares'
      const sharesBody = {
        owner: currentAuthor,
        text: {
          text,
        },
        distribution: {
          linkedInDistributionTarget: {
            visibleToGuest: true,
          },
        },
      }

      const sharesRes = await fetch(sharesUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify(sharesBody),
      })

      if (sharesRes.ok || sharesRes.status === 201) {
        const sharesData = await sharesRes.json()
        if (sharesData.id) return { id: sharesData.id }
        const sharesHeaderId = sharesRes.headers.get('x-restli-id') || sharesRes.headers.get('x-linkedin-id')
        if (sharesHeaderId) return { id: sharesHeaderId }
      } else {
        const sharesErrText = await sharesRes.text()
        try {
          const parsedShares = JSON.parse(sharesErrText)
          if (parsedShares.message) lastError = parsedShares.message
        } catch {}
      }
    } catch (sharesErr) {
      console.warn('LinkedIn /v2/shares error:', sharesErr)
    }
  }

  throw new Error(`LinkedIn post failed: ${lastError || 'Unknown LinkedIn API error'}`)
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
