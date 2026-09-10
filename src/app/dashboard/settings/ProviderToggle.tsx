'use client'

import { useState } from 'react'
import { FacebookProvider } from '@/types/database'
import { Layers, Zap, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  initialProvider: FacebookProvider
  hasBuffer: boolean
  hasFacebook: boolean
}

export default function ProviderToggle({
  initialProvider,
  hasBuffer,
  hasFacebook,
}: Props) {
  const [provider, setProvider] = useState<FacebookProvider>(initialProvider)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  async function handleToggle(newProvider: FacebookProvider) {
    if (newProvider === provider) return
    setError(null)
    setSuccessMsg(null)

    if (newProvider === 'facebook_api' && !hasFacebook) {
      setError('Please connect your Facebook account below before activating direct Facebook API scheduling.')
      return
    }

    if (newProvider === 'buffer' && !hasBuffer) {
      setError('Please connect your Buffer account below to schedule via Buffer.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/users/provider', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facebook_provider: newProvider }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update publishing provider')
      }

      setProvider(newProvider)
      setSuccessMsg(
        newProvider === 'facebook_api'
          ? 'Facebook API is now your active publisher for Facebook posts.'
          : 'Buffer is now your active publisher for Facebook posts.'
      )
      setTimeout(() => setSuccessMsg(null), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change provider')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Option 1: Buffer */}
        <button
          type="button"
          onClick={() => handleToggle('buffer')}
          disabled={loading}
          className={cn(
            'flex-1 text-left p-4 rounded-xl border-2 transition-all relative cursor-pointer',
            provider === 'buffer'
              ? 'border-ms-blue bg-blue-50/40 shadow-sm'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50'
          )}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center',
                  provider === 'buffer' ? 'bg-ms-blue text-white' : 'bg-gray-100 text-gray-600'
                )}
              >
                <Layers size={16} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Buffer</h3>
                <p className="text-xs text-gray-500">Multi-channel queue & queue manager</p>
              </div>
            </div>
            {provider === 'buffer' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ms-blue bg-blue-100/70 px-2 py-0.5 rounded-full">
                <CheckCircle2 size={11} /> Active
              </span>
            )}
          </div>
          <p className="mt-2.5 text-xs text-gray-600 leading-relaxed">
            Routes Facebook, Twitter/X, and LinkedIn posts through your connected Buffer account queue.
          </p>
        </button>

        {/* Option 2: Facebook Graph API */}
        <button
          type="button"
          onClick={() => handleToggle('facebook_api')}
          disabled={loading}
          className={cn(
            'flex-1 text-left p-4 rounded-xl border-2 transition-all relative cursor-pointer',
            provider === 'facebook_api'
              ? 'border-blue-600 bg-blue-50/40 shadow-sm'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50'
          )}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center font-bold',
                  provider === 'facebook_api' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                )}
              >
                <Zap size={16} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Direct Facebook API</h3>
                <p className="text-xs text-gray-500">Official Meta Graph API</p>
              </div>
            </div>
            {provider === 'facebook_api' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-100/70 px-2 py-0.5 rounded-full">
                <CheckCircle2 size={11} /> Active
              </span>
            )}
          </div>
          <p className="mt-2.5 text-xs text-gray-600 leading-relaxed">
            Directly schedules and publishes Facebook Page posts via Meta Graph API without Buffer limits.
          </p>
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <RefreshCw size={12} className="animate-spin text-ms-blue" />
          Updating default publishing provider...
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <CheckCircle2 size={14} className="shrink-0" />
          {successMsg}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}
    </div>
  )
}
