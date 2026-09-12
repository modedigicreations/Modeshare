'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import FacebookIcon from '@/components/ui/FacebookIcon'
import { CheckCircle2, AlertCircle, ExternalLink, RefreshCw, Trash2, ArrowRight } from 'lucide-react'

declare global {
  interface Window {
    FB?: {
      login: (
        callback: (response: { authResponse?: { accessToken: string; userID?: string }; status: string }) => void,
        options: { scope: string; return_scopes?: boolean }
      ) => void
    }
  }
}

interface PageOption {
  id: string
  name: string
  category?: string
  isActive: boolean
}

interface Props {
  isConnected: boolean
  pageName: string | null
  pageId: string | null
  connectedAt: string | null
  appIdConfigured: boolean
  appId?: string
}

export default function FacebookConnectCard({
  isConnected,
  pageName,
  pageId,
  appIdConfigured,
  appId,
}: Props) {
  const [pages, setPages] = useState<PageOption[]>([])
  const [loadingPages, setLoadingPages] = useState(false)
  const [switchingPage, setSwitchingPage] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [selectedPageId, setSelectedPageId] = useState<string>(pageId || '')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState('')
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [, startTransition] = useTransition()

  const [configId, setConfigId] = useState('')
  const [manualToken, setManualToken] = useState('')
  const [appSecret, setAppSecret] = useState('')
  const [savingToken, setSavingToken] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin)
      const savedConfig = localStorage.getItem('modeshare_fb_config_id')
      if (savedConfig) setConfigId(savedConfig)
      const savedSecret = localStorage.getItem('modeshare_fb_app_secret')
      if (savedSecret) setAppSecret(savedSecret)
    }
  }, [])

  function handleAppSecretChange(val: string) {
    const trimmed = val.trim()
    setAppSecret(trimmed)
    if (typeof window !== 'undefined') {
      if (trimmed) {
        localStorage.setItem('modeshare_fb_app_secret', trimmed)
      } else {
        localStorage.removeItem('modeshare_fb_app_secret')
      }
    }
  }

  async function handleManualTokenConnect() {
    if (!manualToken.trim()) return
    setSavingToken(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/facebook/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: manualToken.trim(),
          appSecret: appSecret.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to connect Facebook Page')

      const tokenMsg = data.isDirectPageToken
        ? 'Direct Page Token verified and saved (Permanent).'
        : 'User Token successfully exchanged for a long-lived Page Token.'

      setSuccess(`Connected successfully to ${data.page?.name || 'Facebook Page'}! ${tokenMsg}`)
      setTimeout(() => {
        window.location.reload()
      }, 1800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect Facebook account')
      setSavingToken(false)
    }
  }

  function handleConfigIdChange(val: string) {
    const trimmed = val.trim()
    setConfigId(trimmed)
    if (typeof window !== 'undefined') {
      if (trimmed) {
        localStorage.setItem('modeshare_fb_config_id', trimmed)
      } else {
        localStorage.removeItem('modeshare_fb_config_id')
      }
    }
  }

  useEffect(() => {
    if (isConnected) {
      fetchPages()
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [isConnected])

  async function fetchPages() {
    setLoadingPages(true)
    setError(null)
    try {
      const res = await fetch('/api/facebook/pages')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch pages')
      setPages(data.pages || [])
      if (data.activePageId) {
        setSelectedPageId(data.activePageId)
      }
    } catch (err) {
      console.error('Fetch pages error:', err)
    } finally {
      setLoadingPages(false)
    }
  }

  async function handlePageChange(newPageId: string) {
    if (!newPageId || newPageId === selectedPageId) return
    setSwitchingPage(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/facebook/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: newPageId }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to switch page')

      setSelectedPageId(newPageId)
      setSuccess(`Active Facebook Page switched to ${data.activePage?.name || 'new page'}`)
      setTimeout(() => setSuccess(null), 4000)
      startTransition(() => {
        // trigger client refresh if needed
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch page')
    } finally {
      setSwitchingPage(false)
    }
  }

  async function handleConnectSdk() {
    setError(null)
    setConnecting(true)

    // Set a safety timeout of 10s in case the popup was blocked by browser or closed without response
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setConnecting(false)
      setError('Popup was closed or blocked by your browser. You can click "Direct OAuth Login" below instead.')
    }, 10000)

    try {
      const activeConfigId = configId || process.env.NEXT_PUBLIC_FACEBOOK_CONFIG_ID || ''
      const loginOptions = activeConfigId
        ? { config_id: activeConfigId }
        : {
            scope: 'pages_show_list,pages_read_engagement,pages_manage_posts,public_profile',
            return_scopes: true,
          }

      if (typeof window !== 'undefined' && window.FB) {
        window.FB.login(
          async (response) => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
            if (response.authResponse?.accessToken) {
              try {
                const res = await fetch('/api/facebook/token', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ accessToken: response.authResponse.accessToken }),
                })

                const data = await res.json()
                if (!res.ok) throw new Error(data.error || 'Failed to link Facebook account')

                window.location.reload()
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to save Facebook connection')
                setConnecting(false)
              }
            } else {
              // User closed popup or cancelled
              setConnecting(false)
            }
          },
          loginOptions as any
        )
      } else {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        const connectUrl = activeConfigId
          ? `/api/facebook/connect?config_id=${encodeURIComponent(activeConfigId)}`
          : '/api/facebook/connect'
        window.location.href = connectUrl
      }
    } catch (err) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      setConnecting(false)
      const activeConfigId = configId || process.env.NEXT_PUBLIC_FACEBOOK_CONFIG_ID || ''
      const connectUrl = activeConfigId
        ? `/api/facebook/connect?config_id=${encodeURIComponent(activeConfigId)}`
        : '/api/facebook/connect'
      window.location.href = connectUrl
    }
  }

  async function handleDisconnect() {
    if (!confirm('Are you sure you want to disconnect Facebook API integration?')) return
    setDisconnecting(true)
    setError(null)

    try {
      const res = await fetch('/api/facebook/disconnect', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to disconnect')
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect')
      setDisconnecting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <FacebookIcon size={18} />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">Facebook API Integration</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Connect your Meta Facebook Page for native scheduling and publishing
              </p>
            </div>
          </div>
          {isConnected ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
              <CheckCircle2 size={12} />
              Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
              Not connected
            </span>
          )}
        </div>
      </CardHeader>

      <CardBody className="space-y-4">
        {isConnected ? (
          <>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                  Connected Facebook Page
                </label>
                {loadingPages ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400 py-1.5">
                    <RefreshCw size={12} className="animate-spin text-blue-600" />
                    Loading Facebook Pages...
                  </div>
                ) : pages.length > 1 ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedPageId}
                      onChange={(e) => handlePageChange(e.target.value)}
                      disabled={switchingPage}
                      aria-label="Select Active Facebook Page"
                      className="text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex-1 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      {pages.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.category ? `(${p.category})` : ''}
                        </option>
                      ))}
                    </select>
                    {switchingPage && <RefreshCw size={14} className="animate-spin text-blue-600" />}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm bg-blue-50/60 border border-blue-100 rounded-lg px-3 py-2 text-gray-800">
                    <CheckCircle2 size={15} className="text-blue-600" />
                    <span className="font-semibold">{pageName || 'Facebook Page'}</span>
                    <span className="text-xs text-gray-400 font-mono">({pageId})</span>
                  </div>
                )}
              </div>

              {success && (
                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <CheckCircle2 size={14} className="shrink-0" />
                  {success}
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertCircle size={14} className="shrink-0" />
                  {error}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
              <a
                href={configId ? `/api/facebook/connect?config_id=${encodeURIComponent(configId)}` : '/api/facebook/connect'}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw size={12} />
                Reconnect or switch account
              </a>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
                loading={disconnecting}
                className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 size={12} className="mr-1" />
                Disconnect
              </Button>
            </div>

            {/* Quick token refresh box */}
            <details className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-2.5">
              <summary className="font-medium text-gray-700 cursor-pointer select-none flex items-center justify-between">
                <span>⚡ Renew with Permanent Access Token</span>
                <span className="text-[10px] text-blue-600 font-medium">Click to expand</span>
              </summary>
              <div className="mt-2.5 space-y-2.5 pt-2 border-t border-gray-200 text-[11px]">
                <p className="text-gray-600 leading-relaxed">
                  To prevent token expiration permanently, paste a <strong>Never-Expiring Page Token</strong> or enter your <strong>Meta App Secret</strong> below:
                </p>
                <div className="space-y-2">
                  <input
                    type="password"
                    placeholder="Paste Meta Access Token (EAA...)"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 font-mono text-xs text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="Meta App Secret (optional for permanent upgrade)"
                      value={appSecret}
                      onChange={(e) => handleAppSecretChange(e.target.value)}
                      className="flex-1 bg-white border border-gray-300 rounded px-2.5 py-1.5 font-mono text-xs text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleManualTokenConnect}
                      loading={savingToken}
                      disabled={!manualToken.trim()}
                      className="bg-blue-600 hover:bg-blue-700 text-white shrink-0 text-xs px-3"
                    >
                      Save & Link
                    </Button>
                  </div>
                </div>
              </div>
            </details>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Link your Facebook Page directly using Meta Graph API to schedule and publish Facebook posts natively.
            </p>

            <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 text-xs text-blue-800">
              Requires a Meta account with Administrator or Editor permissions on the target Facebook Page.
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {!appIdConfigured ? (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-700 space-y-1">
                <p className="font-semibold">Facebook Configuration Missing:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>`FACEBOOK_APP_ID` is not set</li>
                  <li>`FACEBOOK_APP_SECRET` is not set</li>
                </ul>
                <p className="mt-1 text-[10px] text-red-500">
                  Configure these in your environment variables to enable Facebook API connection.
                </p>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <a
                  href="/api/facebook/connect"
                  className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition shadow-sm cursor-pointer"
                >
                  <FacebookIcon size={16} />
                  Connect Facebook Page
                  <ArrowRight size={13} className="opacity-80" />
                </a>

                {/* Instant Permanent Token Setup */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 text-xs text-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <span>⚡ Permanent Access Token Connection</span>
                    </span>
                    <a
                      href="https://developers.facebook.com/tools/explorer/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
                    >
                      Graph Explorer <ExternalLink size={11} />
                    </a>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Paste your Facebook User or Page Access Token from Meta. Providing your App Secret will automatically upgrade it to a permanent never-expiring token:
                  </p>
                  <div className="space-y-2">
                    <input
                      type="password"
                      placeholder="Paste Meta Access Token (EAA...)"
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="Meta App Secret (optional for auto-exchange)"
                        value={appSecret}
                        onChange={(e) => handleAppSecretChange(e.target.value)}
                        className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleManualTokenConnect}
                        loading={savingToken}
                        disabled={!manualToken.trim()}
                        className="bg-slate-900 hover:bg-black text-white shrink-0 text-xs px-3"
                      >
                        Connect Page
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Advanced Configuration (Collapsed by default for regular staff) */}
                <details className="text-xs text-gray-500 bg-gray-50/70 border border-gray-200/80 rounded-lg px-3 py-2">
                  <summary className="font-medium text-gray-600 cursor-pointer select-none">
                    Advanced Developer Settings
                  </summary>
                  <div className="mt-2.5 space-y-2 pt-2 border-t border-gray-200/60 text-[11px]">
                    <div>
                      <label className="block font-medium text-gray-700 mb-1">
                        Login Configuration ID:
                      </label>
                      <input
                        type="text"
                        placeholder="1615779169941437"
                        value={configId}
                        onChange={(e) => handleConfigIdChange(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded px-2.5 py-1 text-xs font-mono text-gray-800"
                      />
                    </div>
                    <div className="space-y-1 font-mono bg-white border border-gray-200 rounded p-2 text-gray-600">
                      <div><strong>App ID:</strong> {appId || '948046124459514'}</div>
                      <div><strong>Redirect URI:</strong> {origin || 'https://modeshare.net'}/api/facebook/callback</div>
                    </div>
                  </div>
                </details>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
