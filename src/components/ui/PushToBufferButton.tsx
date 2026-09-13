'use client'

import { useState } from 'react'
import { Send, CheckCircle2, AlertCircle, ChevronDown, Layers } from 'lucide-react'
import Button from './Button'
import FacebookIcon from '@/components/ui/FacebookIcon'
import TwitterIcon from '@/components/ui/TwitterIcon'
import LinkedInIcon from '@/components/ui/LinkedInIcon'
import {
  Platform,
  FacebookProvider,
  TwitterProvider,
  LinkedInProvider,
  PublishingProvider,
} from '@/types/database'

interface Props {
  postId: string
  platform?: Platform
  provider?: FacebookProvider | PublishingProvider
  facebookProvider?: FacebookProvider
  twitterProvider?: TwitterProvider
  linkedinProvider?: LinkedInProvider
  onSuccess?: () => void
}

export default function PushToBufferButton({
  postId,
  platform,
  provider,
  facebookProvider,
  twitterProvider,
  linkedinProvider,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [doneProvider, setDoneProvider] = useState<PublishingProvider | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Determine initial selected provider based on platform and user preferences
  const initialProvider: PublishingProvider = (() => {
    if (platform === 'facebook') {
      return facebookProvider || (provider === 'facebook_api' ? 'facebook_api' : 'buffer')
    }
    if (platform === 'twitter') {
      return twitterProvider || (provider === 'twitter_api' ? 'twitter_api' : 'buffer')
    }
    if (platform === 'linkedin') {
      return linkedinProvider || (provider === 'linkedin_api' ? 'linkedin_api' : 'buffer')
    }
    return 'buffer'
  })()

  const [selectedProvider, setSelectedProvider] = useState<PublishingProvider>(initialProvider)
  const [showDropdown, setShowDropdown] = useState(false)

  async function handlePush(targetProvider: PublishingProvider = selectedProvider) {
    setLoading(true)
    setError(null)
    setShowDropdown(false)

    try {
      let endpoint = '/api/buffer/schedule'
      if (platform === 'facebook' && targetProvider === 'facebook_api') {
        endpoint = '/api/facebook/schedule'
      } else if (platform === 'twitter' && targetProvider === 'twitter_api') {
        endpoint = '/api/twitter/schedule'
      } else if (platform === 'linkedin' && targetProvider === 'linkedin_api') {
        endpoint = '/api/linkedin/schedule'
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to schedule')

      setDoneProvider(targetProvider)
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule')
    } finally {
      setLoading(false)
    }
  }

  if (doneProvider) {
    let successText = 'Sent to Buffer'
    if (doneProvider === 'facebook_api') successText = 'Scheduled on Facebook'
    if (doneProvider === 'twitter_api') successText = 'Published on X / Twitter'
    if (doneProvider === 'linkedin_api') successText = 'Published on LinkedIn'

    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-green-600 font-medium">
        <CheckCircle2 size={13} />
        {successText}
      </span>
    )
  }

  const isFacebook = platform === 'facebook'
  const isTwitter = platform === 'twitter'
  const isLinkedIn = platform === 'linkedin'
  const hasDirectOption = isFacebook || isTwitter || isLinkedIn

  let directLabel = 'Push Direct'
  let directIcon = <Send size={13} />
  let directColorClass = ''

  if (isFacebook) {
    directLabel = 'Push to Facebook API'
    directIcon = <FacebookIcon size={13} className="text-blue-600" />
    directColorClass = 'text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200'
  } else if (isTwitter) {
    directLabel = 'Post to X / Twitter'
    directIcon = <TwitterIcon size={13} className="text-gray-900" />
    directColorClass = 'text-gray-900 bg-gray-100 hover:bg-gray-200 border-gray-300'
  } else if (isLinkedIn) {
    directLabel = 'Post to LinkedIn'
    directIcon = <LinkedInIcon size={13} className="text-[#0A66C2]" />
    directColorClass = 'text-[#0A66C2] bg-blue-50 hover:bg-blue-100 border-blue-200'
  }

  const isDirectSelected =
    (isFacebook && selectedProvider === 'facebook_api') ||
    (isTwitter && selectedProvider === 'twitter_api') ||
    (isLinkedIn && selectedProvider === 'linkedin_api')

  return (
    <div className="space-y-1 relative inline-block">
      <div className="inline-flex rounded-lg shadow-sm">
        <Button
          size="sm"
          variant="secondary"
          loading={loading}
          onClick={() => handlePush(selectedProvider)}
          className={isDirectSelected ? directColorClass : ''}
        >
          {isDirectSelected ? (
            <>
              {directIcon}
              {directLabel}
            </>
          ) : (
            <>
              <Send size={13} />
              Push to Buffer
            </>
          )}
        </Button>

        {hasDirectOption && (
          <div className="relative">
            <button
              type="button"
              disabled={loading}
              onClick={() => setShowDropdown(!showDropdown)}
              className="h-full px-1.5 bg-gray-100 hover:bg-gray-200 border-l border-gray-200 rounded-r-lg text-gray-600 transition flex items-center justify-center cursor-pointer"
              title="Change publishing provider"
            >
              <ChevronDown size={13} />
            </button>

            {showDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowDropdown(false)}
                />
                <div className="absolute right-0 mt-1 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20 text-left text-xs divide-y divide-gray-50">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProvider('buffer')
                      handlePush('buffer')
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                  >
                    <Layers size={13} className="text-gray-500" />
                    <div>
                      <div className="font-medium">Buffer Queue</div>
                      <div className="text-[10px] text-gray-400">Schedule via Buffer</div>
                    </div>
                  </button>

                  {isFacebook && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProvider('facebook_api')
                        handlePush('facebook_api')
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center gap-2 text-blue-700"
                    >
                      <FacebookIcon size={13} className="text-blue-600" />
                      <div>
                        <div className="font-medium">Facebook API</div>
                        <div className="text-[10px] text-blue-500">Direct Page publish/schedule</div>
                      </div>
                    </button>
                  )}

                  {isTwitter && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProvider('twitter_api')
                        handlePush('twitter_api')
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-gray-900"
                    >
                      <TwitterIcon size={13} className="text-gray-900" />
                      <div>
                        <div className="font-medium">X / Twitter API</div>
                        <div className="text-[10px] text-gray-500">Direct Tweet publish</div>
                      </div>
                    </button>
                  )}

                  {isLinkedIn && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProvider('linkedin_api')
                        handlePush('linkedin_api')
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center gap-2 text-[#0A66C2]"
                    >
                      <LinkedInIcon size={13} className="text-[#0A66C2]" />
                      <div>
                        <div className="font-medium">LinkedIn API</div>
                        <div className="text-[10px] text-blue-500">Direct Post publish</div>
                      </div>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <AlertCircle size={11} className="shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}

