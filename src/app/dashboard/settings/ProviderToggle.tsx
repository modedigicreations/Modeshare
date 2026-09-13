'use client'

import { useState } from 'react'
import { FacebookProvider, TwitterProvider, LinkedInProvider } from '@/types/database'
import { CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'
import FacebookIcon from '@/components/ui/FacebookIcon'
import TwitterIcon from '@/components/ui/TwitterIcon'
import LinkedInIcon from '@/components/ui/LinkedInIcon'

interface Props {
  initialFacebookProvider: FacebookProvider
  initialTwitterProvider: TwitterProvider
  initialLinkedInProvider: LinkedInProvider
  hasBuffer: boolean
  hasFacebook: boolean
  hasTwitter: boolean
  hasLinkedIn: boolean
}

export default function ProviderToggle({
  initialFacebookProvider,
  initialTwitterProvider,
  initialLinkedInProvider,
  hasBuffer,
  hasFacebook,
  hasTwitter,
  hasLinkedIn,
}: Props) {
  const [fbProvider, setFbProvider] = useState<FacebookProvider>(initialFacebookProvider)
  const [twProvider, setTwProvider] = useState<TwitterProvider>(initialTwitterProvider)
  const [liProvider, setLiProvider] = useState<LinkedInProvider>(initialLinkedInProvider)

  const [loadingPlatform, setLoadingPlatform] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  async function handleToggle(
    platform: 'facebook' | 'twitter' | 'linkedin',
    targetProvider: 'buffer' | 'direct_api'
  ) {
    setError(null)
    setSuccessMsg(null)

    if (platform === 'facebook') {
      const newProvider: FacebookProvider = targetProvider === 'direct_api' ? 'facebook_api' : 'buffer'
      if (newProvider === fbProvider) return
      if (newProvider === 'facebook_api' && !hasFacebook) {
        setError('Please connect your Facebook account below before activating direct Facebook API scheduling.')
        return
      }
      if (newProvider === 'buffer' && !hasBuffer) {
        setError('Please connect your Buffer account below to schedule via Buffer.')
        return
      }

      setLoadingPlatform('facebook')
      try {
        const res = await fetch('/api/users/provider', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ facebook_provider: newProvider }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to update Facebook provider')
        setFbProvider(newProvider)
        setSuccessMsg(`Facebook publishing mode set to ${newProvider === 'facebook_api' ? 'Direct Facebook API' : 'Buffer'}.`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update provider')
      } finally {
        setLoadingPlatform(null)
      }
    }

    if (platform === 'twitter') {
      const newProvider: TwitterProvider = targetProvider === 'direct_api' ? 'twitter_api' : 'buffer'
      if (newProvider === twProvider) return
      if (newProvider === 'twitter_api' && !hasTwitter) {
        setError('Please connect your Twitter / X account below before activating direct Twitter API publishing.')
        return
      }
      if (newProvider === 'buffer' && !hasBuffer) {
        setError('Please connect your Buffer account below to schedule via Buffer.')
        return
      }

      setLoadingPlatform('twitter')
      try {
        const res = await fetch('/api/users/provider', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ twitter_provider: newProvider }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to update Twitter provider')
        setTwProvider(newProvider)
        setSuccessMsg(`Twitter / X publishing mode set to ${newProvider === 'twitter_api' ? 'Direct Twitter API' : 'Buffer'}.`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update provider')
      } finally {
        setLoadingPlatform(null)
      }
    }

    if (platform === 'linkedin') {
      const newProvider: LinkedInProvider = targetProvider === 'direct_api' ? 'linkedin_api' : 'buffer'
      if (newProvider === liProvider) return
      if (newProvider === 'linkedin_api' && !hasLinkedIn) {
        setError('Please connect your LinkedIn account below before activating direct LinkedIn API publishing.')
        return
      }
      if (newProvider === 'buffer' && !hasBuffer) {
        setError('Please connect your Buffer account below to schedule via Buffer.')
        return
      }

      setLoadingPlatform('linkedin')
      try {
        const res = await fetch('/api/users/provider', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ linkedin_provider: newProvider }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to update LinkedIn provider')
        setLiProvider(newProvider)
        setSuccessMsg(`LinkedIn publishing mode set to ${newProvider === 'linkedin_api' ? 'Direct LinkedIn API' : 'Buffer'}.`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update provider')
      } finally {
        setLoadingPlatform(null)
      }
    }
  }

  const platforms = [
    {
      id: 'facebook' as const,
      name: 'Facebook',
      icon: <FacebookIcon size={16} />,
      iconBg: 'bg-blue-600 text-white',
      isDirectActive: fbProvider === 'facebook_api',
      hasDirect: hasFacebook,
      directLabel: 'Direct Meta Graph API',
    },
    {
      id: 'twitter' as const,
      name: 'Twitter / X',
      icon: <TwitterIcon size={14} />,
      iconBg: 'bg-black text-white',
      isDirectActive: twProvider === 'twitter_api',
      hasDirect: hasTwitter,
      directLabel: 'Direct X API v2',
    },
    {
      id: 'linkedin' as const,
      name: 'LinkedIn',
      icon: <LinkedInIcon size={14} />,
      iconBg: 'bg-[#0A66C2] text-white',
      isDirectActive: liProvider === 'linkedin_api',
      hasDirect: hasLinkedIn,
      directLabel: 'Direct LinkedIn REST API',
    },
  ]

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {platforms.map((p) => {
          const isLoading = loadingPlatform === p.id
          return (
            <div
              key={p.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border border-gray-200 bg-white gap-3 shadow-xs"
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${p.iconBg}`}>
                  {p.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-gray-900">{p.name}</span>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        p.isDirectActive
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-gray-100 text-gray-700 border border-gray-200'
                      }`}
                    >
                      {p.isDirectActive ? p.directLabel : 'Buffer Queue'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {p.isDirectActive
                      ? 'Publishes directly without Buffer queue limits'
                      : 'Publishes via your connected Buffer account'}
                  </p>
                </div>
              </div>

              {/* Segmented Controller Switch */}
              <div className="flex bg-gray-100 p-0.5 rounded-lg shrink-0 self-start sm:self-auto border border-gray-200">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleToggle(p.id, 'buffer')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                    !p.isDirectActive
                      ? 'bg-white text-gray-900 shadow-xs font-semibold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Buffer
                </button>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleToggle(p.id, 'direct_api')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                    p.isDirectActive
                      ? 'bg-blue-600 text-white shadow-xs font-semibold'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Direct API
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {loadingPlatform && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <RefreshCw size={12} className="animate-spin text-blue-600" />
          Updating publishing provider...
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
