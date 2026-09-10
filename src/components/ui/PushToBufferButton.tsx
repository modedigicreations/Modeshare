'use client'

import { useState } from 'react'
import { Send, CheckCircle2, AlertCircle, ChevronDown, Layers } from 'lucide-react'
import Button from './Button'
import FacebookIcon from '@/components/ui/FacebookIcon'
import { Platform, FacebookProvider } from '@/types/database'

interface Props {
  postId: string
  platform?: Platform
  provider?: FacebookProvider
  onSuccess?: () => void
}

export default function PushToBufferButton({
  postId,
  platform,
  provider = 'buffer',
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [doneProvider, setDoneProvider] = useState<FacebookProvider | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<FacebookProvider>(
    platform === 'facebook' ? provider : 'buffer'
  )
  const [showDropdown, setShowDropdown] = useState(false)

  async function handlePush(targetProvider: FacebookProvider = selectedProvider) {
    setLoading(true)
    setError(null)
    setShowDropdown(false)

    try {
      const endpoint =
        platform === 'facebook' && targetProvider === 'facebook_api'
          ? '/api/facebook/schedule'
          : '/api/buffer/schedule'

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
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-green-600 font-medium">
        <CheckCircle2 size={13} />
        {doneProvider === 'facebook_api' ? 'Scheduled on Facebook' : 'Sent to Buffer'}
      </span>
    )
  }

  const isFacebook = platform === 'facebook'

  return (
    <div className="space-y-1 relative inline-block">
      <div className="inline-flex rounded-lg shadow-sm">
        <Button
          size="sm"
          variant="secondary"
          loading={loading}
          onClick={() => handlePush(selectedProvider)}
          className={isFacebook && selectedProvider === 'facebook_api' ? 'text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200' : ''}
        >
          {isFacebook && selectedProvider === 'facebook_api' ? (
            <>
              <FacebookIcon size={13} className="text-blue-600" />
              Push to Facebook API
            </>
          ) : (
            <>
              <Send size={13} />
              Push to Buffer
            </>
          )}
        </Button>

        {isFacebook && (
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
                <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20 text-left text-xs divide-y divide-gray-50">
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
