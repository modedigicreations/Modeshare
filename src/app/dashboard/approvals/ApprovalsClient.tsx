'use client'

import { useState } from 'react'
import { Post, Platform, PostStatus } from '@/types/database'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import {
  PLATFORM_LABELS,
  PLATFORM_COLORS,
  POST_STATUS_COLORS,
  POST_STATUS_LABELS,
  formatDate,
  cn,
} from '@/lib/utils'
import {
  CheckCircle2,
  XCircle,
  Pencil,
  Save,
  X,
  CalendarDays,
  User,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Sparkles,
} from 'lucide-react'

type EnrichedPost = Post & {
  brief: { topic: string; tone: string; target_date: string | null; platforms: string[] }
  profile: { full_name: string | null; email: string }
}

interface Props {
  initialPosts: EnrichedPost[]
}

function PlatformDot({ platform }: { platform: Platform }) {
  const map: Record<Platform, { letter: string; bg: string }> = {
    facebook: { letter: 'f', bg: 'bg-blue-600' },
    twitter: { letter: 'X', bg: 'bg-slate-800' },
    linkedin: { letter: 'in', bg: 'bg-blue-800' },
  }
  const { letter, bg } = map[platform]
  return (
    <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-white text-[10px] font-bold shrink-0 ${bg}`}>
      {letter}
    </span>
  )
}

type PostState = {
  status: PostStatus
  content: string
  reviewer_note?: string | null
  scheduled_at?: string | null
}

export default function ApprovalsClient({ initialPosts }: Props) {
  const [posts] = useState<EnrichedPost[]>(initialPosts)
  const [postStates, setPostStates] = useState<Record<string, PostState>>(() =>
    Object.fromEntries(
      initialPosts.map((p) => [
        p.id,
        { status: p.status, content: p.content, reviewer_note: p.reviewer_note, scheduled_at: p.scheduled_at },
      ])
    )
  )
  const [editing, setEditing] = useState<Record<string, boolean>>({})
  const [editContent, setEditContent] = useState<Record<string, string>>({})
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({})
  const [showRejectForm, setShowRejectForm] = useState<Record<string, boolean>>({})
  const [showRewriteForm, setShowRewriteForm] = useState<Record<string, boolean>>({})
  const [rewriteInstruction, setRewriteInstruction] = useState<Record<string, string>>({})
  const [scheduledAt, setScheduledAt] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState<Record<string, string>>({}) // postId -> action
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [filter, setFilter] = useState<'all' | Platform>('all')

  const visible = posts.filter((p) => {
    const state = postStates[p.id]
    if (state?.status !== 'pending_review') return false
    if (filter !== 'all' && p.platform !== filter) return false
    return true
  })

  async function callApi(postId: string, action: string, body: Record<string, unknown>) {
    setLoading((prev) => ({ ...prev, [postId]: action }))
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Request failed')
      return json.post
    } finally {
      setLoading((prev) => {
        const next = { ...prev }
        delete next[postId]
        return next
      })
    }
  }

  async function handleApprove(postId: string) {
    const post = await callApi(postId, 'approve', {
      scheduled_at: scheduledAt[postId] || undefined,
    })
    if (post) {
      setPostStates((prev) => ({ ...prev, [postId]: { ...prev[postId], status: 'approved', scheduled_at: post.scheduled_at } }))
    }
  }

  async function handleReject(postId: string) {
    const post = await callApi(postId, 'reject', {
      reviewer_note: rejectNote[postId] || undefined,
    })
    if (post) {
      setPostStates((prev) => ({
        ...prev,
        [postId]: { ...prev[postId], status: 'rejected', reviewer_note: rejectNote[postId] },
      }))
      setShowRejectForm((prev) => ({ ...prev, [postId]: false }))
    }
  }

  async function handleRewrite(postId: string) {
    const instruction = rewriteInstruction[postId]
    if (!instruction) return
    const post = await callApi(postId, 'rewrite', { instruction })
    if (post) {
      setPostStates((prev) => ({ ...prev, [postId]: { ...prev[postId], content: post.content } }))
      setShowRewriteForm((prev) => ({ ...prev, [postId]: false }))
      setRewriteInstruction((prev) => ({ ...prev, [postId]: '' }))
    }
  }

  async function handleSaveEdit(postId: string) {
    const content = editContent[postId]
    const post = await callApi(postId, 'edit', { content })
    if (post) {
      setPostStates((prev) => ({ ...prev, [postId]: { ...prev[postId], content } }))
      setEditing((prev) => ({ ...prev, [postId]: false }))
    }
  }

  function startEdit(postId: string, currentContent: string) {
    setEditContent((prev) => ({ ...prev, [postId]: currentContent }))
    setEditing((prev) => ({ ...prev, [postId]: true }))
  }

  const platforms: Platform[] = ['facebook', 'twitter', 'linkedin']
  const counts = platforms.reduce<Record<string, number>>((acc, p) => {
    acc[p] = posts.filter((post) => post.platform === p && postStates[post.id]?.status === 'pending_review').length
    return acc
  }, {})
  const totalPending = posts.filter((p) => postStates[p.id]?.status === 'pending_review').length

  if (initialPosts.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center py-20 text-center px-6">
          <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mb-4">
            <ClipboardCheck size={28} className="text-green-500" />
          </div>
          <h3 className="font-semibold text-gray-700 mb-1">All caught up!</h3>
          <p className="text-sm text-gray-500">No posts are waiting for review right now.</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-medium transition',
            filter === 'all'
              ? 'bg-ms-blue text-white'
              : 'bg-white border border-gray-200 text-gray-600 hover:border-ms-blue'
          )}
        >
          All ({totalPending})
        </button>
        {platforms.map((p) => (
          <button
            key={p}
            onClick={() => setFilter(p)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5',
              filter === p
                ? 'bg-ms-blue text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-ms-blue'
            )}
          >
            <PlatformDot platform={p} />
            {PLATFORM_LABELS[p]} ({counts[p]})
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Card>
          <div className="py-12 text-center text-gray-400 text-sm">
            No pending posts for this platform
          </div>
        </Card>
      ) : (
        visible.map((post) => {
          const state = postStates[post.id]
          const isEditing = editing[post.id]
          const isExpanded = expanded[post.id]
          const isLoading = !!loading[post.id]
          const currentContent = isEditing ? editContent[post.id] : state.content
          const authorName = post.profile.full_name || post.profile.email

          return (
            <Card key={post.id} className="overflow-hidden">
              <CardHeader className="bg-gray-50/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <PlatformDot platform={post.platform as Platform} />
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        {post.brief.topic}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <Badge className={PLATFORM_COLORS[post.platform as Platform]}>
                          {PLATFORM_LABELS[post.platform as Platform]}
                        </Badge>
                        <Badge className={POST_STATUS_COLORS[state.status]}>
                          {POST_STATUS_LABELS[state.status]}
                        </Badge>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <User size={11} />
                          {authorName}
                        </span>
                        {post.brief.target_date && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <CalendarDays size={11} />
                            {formatDate(post.brief.target_date)}
                          </span>
                        )}
                        <span className="text-xs text-gray-400 capitalize">
                          Variant {post.variant_index} · {post.brief.tone} tone
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setExpanded((prev) => ({ ...prev, [post.id]: !isExpanded }))}
                    className="text-gray-400 hover:text-gray-600 shrink-0 mt-1"
                  >
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardBody className="space-y-4">
                  {/* Post content */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Post content
                      </label>
                      <div className="flex items-center gap-3">
                        {!isEditing && (
                          <button
                            onClick={() => setShowRewriteForm((prev) => ({ ...prev, [post.id]: !showRewriteForm[post.id] }))}
                            className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700"
                          >
                            <Sparkles size={12} />
                            AI Rewrite
                          </button>
                        )}
                        {!isEditing ? (
                          <button
                            onClick={() => startEdit(post.id, state.content)}
                            className="flex items-center gap-1 text-xs text-ms-blue hover:text-ms-blue-dark"
                          >
                            <Pencil size={12} />
                            Edit
                          </button>
                        ) : (
                          <button
                            onClick={() => setEditing((prev) => ({ ...prev, [post.id]: false }))}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
                          >
                            <X size={12} />
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea
                          value={editContent[post.id]}
                          onChange={(e) =>
                            setEditContent((prev) => ({ ...prev, [post.id]: e.target.value }))
                          }
                          rows={6}
                          className="w-full px-3 py-2.5 border border-ms-blue rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ms-blue/30 resize-none"
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">
                            {editContent[post.id]?.length || 0} chars
                          </span>
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={loading[post.id] === 'edit'}
                            onClick={() => handleSaveEdit(post.id)}
                          >
                            <Save size={13} />
                            Save edit
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                          {currentContent}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">{currentContent?.length || 0} chars</p>
                      </div>
                    )}
                  </div>

                  {/* AI Rewrite Form */}
                  {showRewriteForm[post.id] && (
                    <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-1 text-xs font-semibold text-purple-700">
                        <Sparkles size={13} />
                        Instruct AI to Rewrite
                      </div>
                      <textarea
                        value={rewriteInstruction[post.id] || ''}
                        onChange={(e) =>
                          setRewriteInstruction((prev) => ({ ...prev, [post.id]: e.target.value }))
                        }
                        rows={2}
                        placeholder="e.g. Make it punchier, add relevant hashtags, shorten it..."
                        className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 bg-white resize-none"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-purple-600 hover:bg-purple-700"
                          loading={loading[post.id] === 'rewrite'}
                          onClick={() => handleRewrite(post.id)}
                        >
                          <Sparkles size={13} />
                          Rewrite Post
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowRewriteForm((prev) => ({ ...prev, [post.id]: false }))}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Schedule picker */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                      Schedule date & time{' '}
                      <span className="text-gray-400 normal-case font-normal">(optional — leave blank to post now)</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={scheduledAt[post.id] || ''}
                      min={new Date().toISOString().slice(0, 16)}
                      onChange={(e) =>
                        setScheduledAt((prev) => ({ ...prev, [post.id]: e.target.value }))
                      }
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ms-blue/30"
                    />
                  </div>

                  {/* Reject note form */}
                  {showRejectForm[post.id] && (
                    <div className="bg-red-50 border border-red-100 rounded-xl p-4 space-y-3">
                      <label className="block text-xs font-medium text-red-700">
                        Rejection reason (optional)
                      </label>
                      <textarea
                        value={rejectNote[post.id] || ''}
                        onChange={(e) =>
                          setRejectNote((prev) => ({ ...prev, [post.id]: e.target.value }))
                        }
                        rows={2}
                        placeholder="Let the creator know why this was rejected..."
                        className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200 bg-white resize-none"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="danger"
                          loading={loading[post.id] === 'reject'}
                          onClick={() => handleReject(post.id)}
                        >
                          <XCircle size={13} />
                          Confirm rejection
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowRejectForm((prev) => ({ ...prev, [post.id]: false }))}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                    <Button
                      size="sm"
                      variant="primary"
                      loading={loading[post.id] === 'approve'}
                      disabled={isLoading}
                      onClick={() => handleApprove(post.id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle2 size={14} />
                      Approve
                    </Button>
                    {!showRejectForm[post.id] && (
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={isLoading}
                        onClick={() =>
                          setShowRejectForm((prev) => ({ ...prev, [post.id]: true }))
                        }
                      >
                        <XCircle size={14} />
                        Reject
                      </Button>
                    )}
                  </div>
                </CardBody>
              )}

              {/* Collapsed preview */}
              {!isExpanded && (
                <div
                  className="px-5 py-3 cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => setExpanded((prev) => ({ ...prev, [post.id]: true }))}
                >
                  <p className="text-sm text-gray-500 truncate">{state.content}</p>
                </div>
              )}
            </Card>
          )
        })
      )}
    </div>
  )
}
