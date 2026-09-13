'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import TwitterIcon from '@/components/ui/TwitterIcon'
import { CheckCircle2, AlertCircle, RefreshCw, Trash2, ArrowRight } from 'lucide-react'

interface Props {
  isConnected: boolean
  username: string | null
  userId: string | null
  connectedAt: string | null
  clientIdConfigured: boolean
}

export default function TwitterConnectCard({
  isConnected,
  username,
  userId,
  clientIdConfigured,
}: Props) {
  const [disconnecting, setDisconnecting] = useState(false)
  const [manualToken, setManualToken] = useState('')
  const [savingToken, setSavingToken] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin)
    }
  }, [])

  async function handleManualTokenConnect() {
    if (!manualToken.trim()) return
    setSavingToken(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/twitter/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: manualToken.trim() }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to connect Twitter account')

      setSuccess(`Connected successfully to @${data.user?.username || 'Twitter'}!`)
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect Twitter account')
      setSavingToken(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm('Are you sure you want to disconnect Twitter / X integration?')) return
    setDisconnecting(true)
    setError(null)

    try {
      const res = await fetch('/api/twitter/disconnect', { method: 'POST' })
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
            <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center">
              <TwitterIcon size={16} />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">Twitter / X API Integration</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Connect your Twitter / X account for direct native posting
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
                  Connected Twitter Account
                </label>
                <div className="flex items-center gap-2 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800">
                  <CheckCircle2 size={15} className="text-black" />
                  <span className="font-semibold">@{username || 'Twitter User'}</span>
                  {userId && <span className="text-xs text-gray-400 font-mono">({userId})</span>}
                </div>
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
                href="/api/twitter/connect"
                className="text-xs font-medium text-gray-700 hover:text-black hover:underline inline-flex items-center gap-1 cursor-pointer"
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
                <span>⚡ Reconnect with Direct OAuth 2.0 Bearer Token</span>
                <span className="text-[10px] text-blue-600 font-medium">Click to expand</span>
              </summary>
              <div className="mt-2.5 space-y-2.5 pt-2 border-t border-gray-200 text-[11px]">
                <p className="text-gray-600 leading-relaxed">
                  Paste a Twitter / X User Bearer Token from Developer Portal:
                </p>
                <div className="space-y-2">
                  <input
                    type="password"
                    placeholder="Paste Twitter Access Token"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 font-mono text-xs text-gray-800 focus:ring-2 focus:ring-black focus:outline-none"
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleManualTokenConnect}
                      loading={savingToken}
                      disabled={!manualToken.trim()}
                      className="bg-black hover:bg-gray-800 text-white shrink-0 text-xs px-3"
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
              Link your Twitter / X account directly using X API v2 to publish tweets natively from Modeshare without Buffer limitations.
            </p>

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {!clientIdConfigured ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800 space-y-1">
                <p className="font-semibold">Twitter OAuth Configuration Missing:</p>
                <p>Set `TWITTER_CLIENT_ID` and `TWITTER_CLIENT_SECRET` in environment variables for one-click OAuth, or connect using a Developer Access Token below:</p>
              </div>
            ) : (
              <a
                href="/api/twitter/connect"
                className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-black hover:bg-gray-800 text-white font-medium text-sm transition shadow-sm cursor-pointer"
              >
                <TwitterIcon size={16} />
                Connect Twitter / X Account
                <ArrowRight size={13} className="opacity-80" />
              </a>
            )}

            {/* Direct Token Setup */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 text-xs text-slate-700">
              <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                <span>⚡ Direct Access Token Connection</span>
              </span>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Paste your Twitter / X User Bearer Token from Developer Portal:
              </p>
              <div className="space-y-2">
                <input
                  type="password"
                  placeholder="Paste Twitter Access Token"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-gray-800 focus:ring-2 focus:ring-black focus:outline-none"
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleManualTokenConnect}
                    loading={savingToken}
                    disabled={!manualToken.trim()}
                    className="bg-black hover:bg-gray-800 text-white shrink-0 text-xs px-3"
                  >
                    Connect Account
                  </Button>
                </div>
              </div>
            </div>

            {/* Developer Settings */}
            <details className="text-xs text-gray-500 bg-gray-50/70 border border-gray-200/80 rounded-lg px-3 py-2">
              <summary className="font-medium text-gray-600 cursor-pointer select-none">
                Developer Redirect URI Info
              </summary>
              <div className="mt-2.5 space-y-1 font-mono bg-white border border-gray-200 rounded p-2 text-gray-600 text-[11px]">
                <div><strong>Redirect URI:</strong> {origin || 'https://modeshare.net'}/api/twitter/callback</div>
              </div>
            </details>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
