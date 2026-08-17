'use client'

import { useState } from 'react'
import { Send, CheckCircle2, AlertCircle } from 'lucide-react'
import Button from './Button'

interface Props {
  postId: string
  onSuccess?: () => void
}

export default function PushToBufferButton({ postId, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePush() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/buffer/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to schedule')
      setDone(true)
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-green-600 font-medium">
        <CheckCircle2 size={13} />
        Sent to Buffer
      </span>
    )
  }

  return (
    <div className="space-y-1">
      <Button
        size="sm"
        variant="secondary"
        loading={loading}
        onClick={handlePush}
      >
        <Send size={13} />
        Push to Buffer
      </Button>
      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <AlertCircle size={11} />
          {error}
        </p>
      )}
    </div>
  )
}
