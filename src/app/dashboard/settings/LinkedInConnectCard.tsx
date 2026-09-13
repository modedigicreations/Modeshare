'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import LinkedInIcon from '@/components/ui/LinkedInIcon'
import { CheckCircle2, AlertCircle, RefreshCw, Trash2, ArrowRight, Building2, User } from 'lucide-react'

interface LinkedInAccountOption {
  id: string
  name: string
  type: 'organization' | 'person'
  isActive: boolean
}

interface Props {
  isConnected: boolean
  accountName: string | null
  accountId: string | null
  accountType: 'organization' | 'person' | null
  clientIdConfigured: boolean
}

export default function LinkedInConnectCard({
  isConnected,
  accountName,
  accountId,
  accountType,
  clientIdConfigured,
}: Props) {
  const [accounts, setAccounts] = useState<LinkedInAccountOption[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [switchingAccount, setSwitchingAccount] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accountId || '')
  const [disconnecting, setDisconnecting] = useState(false)
  const [manualToken, setManualToken] = useState('')
  const [targetAccountId, setTargetAccountId] = useState('')
  const [savingToken, setSavingToken] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin)
    }
  }, [])

  useEffect(() => {
    if (isConnected) {
      fetchAccounts()
    }
  }, [isConnected])

  async function fetchAccounts() {
    setLoadingAccounts(true)
    setError(null)
    try {
      const res = await fetch('/api/linkedin/pages')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch LinkedIn accounts')
      setAccounts(data.accounts || [])
      if (data.activeAccountId) {
        setSelectedAccountId(data.activeAccountId)
      }
    } catch (err) {
      console.warn('Fetch LinkedIn accounts error:', err)
    } finally {
      setLoadingAccounts(false)
    }
  }

  async function handleAccountChange(newAccountId: string) {
    if (!newAccountId || newAccountId === selectedAccountId) return
    setSwitchingAccount(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/linkedin/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: newAccountId }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to switch LinkedIn account')

      setSelectedAccountId(newAccountId)
      setSuccess(`Active LinkedIn account switched to ${data.activeAccount?.name || 'new account'}`)
      setTimeout(() => setSuccess(null), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch account')
    } finally {
      setSwitchingAccount(false)
    }
  }

  async function handleManualTokenConnect() {
    if (!manualToken.trim()) return
    setSavingToken(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/linkedin/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: manualToken.trim(),
          accountId: targetAccountId.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to connect LinkedIn account')

      setSuccess(`Connected successfully to ${data.account?.name || 'LinkedIn account'}!`)
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect LinkedIn account')
      setSavingToken(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm('Are you sure you want to disconnect LinkedIn integration?')) return
    setDisconnecting(true)
    setError(null)

    try {
      const res = await fetch('/api/linkedin/disconnect', { method: 'POST' })
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
            <div className="w-8 h-8 rounded-lg bg-[#0A66C2] text-white flex items-center justify-center">
              <LinkedInIcon size={16} />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">LinkedIn API Integration</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Connect your LinkedIn Company Page or profile for direct native posting
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
                  Connected LinkedIn Account / Company Page
                </label>
                {loadingAccounts ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400 py-1.5">
                    <RefreshCw size={12} className="animate-spin text-[#0A66C2]" />
                    Loading LinkedIn Pages...
                  </div>
                ) : accounts.length > 1 ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedAccountId}
                      onChange={(e) => handleAccountChange(e.target.value)}
                      disabled={switchingAccount}
                      aria-label="Select Active LinkedIn Account"
                      className="text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex-1 focus:ring-2 focus:ring-[#0A66C2] focus:outline-none"
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.type === 'organization' ? '🏢 ' : '👤 '}
                          {a.name} ({a.type})
                        </option>
                      ))}
                    </select>
                    {switchingAccount && <RefreshCw size={14} className="animate-spin text-[#0A66C2]" />}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm bg-blue-50/50 border border-blue-100 rounded-lg px-3 py-2 text-gray-800">
                    {accountType === 'organization' ? (
                      <Building2 size={15} className="text-[#0A66C2]" />
                    ) : (
                      <User size={15} className="text-[#0A66C2]" />
                    )}
                    <span className="font-semibold">{accountName || 'LinkedIn Account'}</span>
                    {accountId && <span className="text-xs text-gray-400 font-mono">({accountId})</span>}
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
                href="/api/linkedin/connect"
                className="text-xs font-medium text-[#0A66C2] hover:underline inline-flex items-center gap-1 cursor-pointer"
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
                <span>⚡ Reconnect with Direct OAuth Token / Page URN</span>
                <span className="text-[10px] text-[#0A66C2] font-medium">Click to expand</span>
              </summary>
              <div className="mt-2.5 space-y-2.5 pt-2 border-t border-gray-200 text-[11px]">
                <p className="text-gray-600 leading-relaxed">
                  Paste a LinkedIn Access Token or specify target Organization ID:
                </p>
                <div className="space-y-2">
                  <input
                    type="password"
                    placeholder="Paste LinkedIn Access Token"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 font-mono text-xs text-gray-800 focus:ring-2 focus:ring-[#0A66C2] focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Target Organization URN/ID (optional, e.g. 123456)"
                    value={targetAccountId}
                    onChange={(e) => setTargetAccountId(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 font-mono text-xs text-gray-800 focus:ring-2 focus:ring-[#0A66C2] focus:outline-none"
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleManualTokenConnect}
                      loading={savingToken}
                      disabled={!manualToken.trim()}
                      className="bg-[#0A66C2] hover:bg-blue-700 text-white shrink-0 text-xs px-3"
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
              Link your LinkedIn Company Page or profile directly using LinkedIn REST API to schedule and publish posts natively without Buffer limitations.
            </p>

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {!clientIdConfigured ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 text-xs text-blue-900 space-y-1">
                <p className="font-semibold">LinkedIn OAuth Configuration Missing:</p>
                <p>Set `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` in environment variables for one-click OAuth, or connect using a Developer Access Token below:</p>
              </div>
            ) : (
              <a
                href="/api/linkedin/connect"
                className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-[#0A66C2] hover:bg-blue-700 text-white font-medium text-sm transition shadow-sm cursor-pointer"
              >
                <LinkedInIcon size={16} />
                Connect LinkedIn Page
                <ArrowRight size={13} className="opacity-80" />
              </a>
            )}

            {/* Direct Token Setup */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 text-xs text-slate-700">
              <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                <span>⚡ Direct Access Token Connection</span>
              </span>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Paste your LinkedIn Access Token and optional Organization ID:
              </p>
              <div className="space-y-2">
                <input
                  type="password"
                  placeholder="Paste LinkedIn Access Token"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-gray-800 focus:ring-2 focus:ring-[#0A66C2] focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Target Organization URN/ID (optional, e.g. 123456)"
                  value={targetAccountId}
                  onChange={(e) => setTargetAccountId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-gray-800 focus:ring-2 focus:ring-[#0A66C2] focus:outline-none"
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleManualTokenConnect}
                    loading={savingToken}
                    disabled={!manualToken.trim()}
                    className="bg-[#0A66C2] hover:bg-blue-700 text-white shrink-0 text-xs px-3"
                  >
                    Connect Page
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
                <div><strong>Redirect URI:</strong> {origin || 'https://modeshare.net'}/api/linkedin/callback</div>
              </div>
            </details>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
