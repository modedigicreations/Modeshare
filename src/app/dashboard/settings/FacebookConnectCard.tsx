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
}

export default function FacebookConnectCard({
  isConnected,
  pageName,
  pageId,
  appIdConfigured,
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin)
      const savedConfig = localStorage.getItem('modeshare_fb_config_id')
      if (savedConfig) {
        setConfigId(savedConfig)
      }
    }
  }, [])

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
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-lg p-3 text-xs text-amber-900 space-y-2">
                  <div className="font-semibold flex items-center justify-between text-amber-900">
                    <span>Login Configuration ID (For Business Apps):</span>
                    <span className="text-[10px] bg-amber-200/70 px-1.5 py-0.5 rounded font-mono">Meta Business Login</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Meta Business Apps require a <strong>Configuration ID</strong>. In Meta Developers, go to:
                    <br />
                    <span className="font-medium">Facebook Login for Business &rarr; Configurations</span> &rarr; copy your numeric Configuration ID and paste it below:
                  </p>
                  <input
                    type="text"
                    placeholder="e.g. 109283746592019 (Configuration ID)"
                    value={configId}
                    onChange={(e) => handleConfigIdChange(e.target.value)}
                    className="w-full bg-white border border-amber-300 rounded-lg px-3 py-1.5 text-xs font-mono text-gray-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleConnectSdk}
                  disabled={connecting}
                  className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition shadow-sm cursor-pointer disabled:opacity-75"
                >
                  {connecting ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      Connecting Facebook...
                    </>
                  ) : (
                    <>
                      <FacebookIcon size={16} />
                      Connect Facebook Page
                      <ExternalLink size={13} className="opacity-80" />
                    </>
                  )}
                </button>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600 space-y-1.5">
                  <div className="font-semibold text-gray-800 flex items-center justify-between">
                    <span>Required Redirect URI in Meta Console:</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`${origin || 'https://modeshare.net'}/api/facebook/callback`)
                        setCopied(true)
                        setTimeout(() => setCopied(false), 2000)
                      }}
                      className="text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
                    >
                      {copied ? 'Copied!' : 'Copy URI'}
                    </button>
                  </div>
                  <code className="block font-mono text-[11px] text-gray-700 bg-white border border-gray-200 rounded px-2 py-1 select-all break-all">
                    {origin || 'https://modeshare.net'}/api/facebook/callback
                  </code>
                </div>

                <div className="text-center pt-0.5">
                  <a
                    href={configId ? `/api/facebook/connect?config_id=${encodeURIComponent(configId)}` : '/api/facebook/connect'}
                    className="text-xs text-gray-500 hover:text-blue-600 font-medium inline-flex items-center gap-1 transition"
                  >
                    Direct OAuth Redirect Link <ArrowRight size={11} />
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
