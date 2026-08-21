'use client'

import { useState, useEffect } from 'react'
import { Post, Platform, Tone } from '@/types/database'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import {
  PLATFORM_LABELS,
  PLATFORM_COLORS,
  cn,
} from '@/lib/utils'
import {
  Sparkles,
  RefreshCw,
  ThumbsUp,
  MousePointerClick,
  Share2,
  MessageSquare,
  TrendingUp,
  FileText,
  AlertCircle,
  HelpCircle,
} from 'lucide-react'

type EnrichedPost = Omit<Post, 'brief' | 'profile'> & {
  brief?: { topic: string; tone: Tone }
  profile?: { full_name: string | null; email: string }
}

interface Props {
  initialPosts: EnrichedPost[]
}

const TONE_EMOJIS: Record<Tone, string> = {
  professional: '👔',
  casual: '😊',
  witty: '😄',
  informative: '📚',
  inspirational: '✨',
}

export default function AnalyticsClient({ initialPosts }: Props) {
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [insights, setInsights] = useState<string | null>(null)
  const [loadingInsights, setLoadingInsights] = useState(false)

  // Fetch AI Insights on mount
  useEffect(() => {
    async function fetchInsights() {
      setLoadingInsights(true)
      try {
        const res = await fetch('/api/analytics/insights')
        const json = await res.json()
        if (res.ok) {
          setInsights(json.insights)
        }
      } catch (err) {
        console.error('Failed to load insights:', err)
      } finally {
        setLoadingInsights(false)
      }
    }
    fetchInsights()
  }, [])

  // Sync metrics from Buffer
  async function handleSync() {
    setSyncing(true)
    setSyncError(null)
    try {
      const res = await fetch('/api/analytics/sync', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Sync failed')
      window.location.reload()
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Failed to sync metrics')
      setSyncing(false)
    }
  }

  // Calculate Aggregates
  let totalReactions = 0
  let totalClicks = 0
  let totalReposts = 0
  let totalComments = 0

  const platformBreakdown: Record<Platform, { posts: number; reactions: number; clicks: number }> = {
    facebook: { posts: 0, reactions: 0, clicks: 0 },
    twitter: { posts: 0, reactions: 0, clicks: 0 },
    linkedin: { posts: 0, reactions: 0, clicks: 0 },
  }

  const toneBreakdown: Record<string, { posts: number; reactions: number; clicks: number }> = {}

  for (const post of initialPosts) {
    const m = post.metrics || {}
    const reactions = Number(m.reactions) || 0
    const clicks = Number(m.clicks) || 0
    const reposts = Number(m.reposts) || 0
    const comments = Number(m.comments) || 0

    totalReactions += reactions
    totalClicks += clicks
    totalReposts += reposts
    totalComments += comments

    const plat = post.platform as Platform
    if (platformBreakdown[plat]) {
      platformBreakdown[plat].posts++
      platformBreakdown[plat].reactions += reactions
      platformBreakdown[plat].clicks += clicks
    }

    const tone = post.brief?.tone
    if (tone) {
      if (!toneBreakdown[tone]) {
        toneBreakdown[tone] = { posts: 0, reactions: 0, clicks: 0 }
      }
      toneBreakdown[tone].posts++
      toneBreakdown[tone].reactions += reactions
      toneBreakdown[tone].clicks += clicks
    }
  }

  // Sort top performing posts by (reactions + clicks + reposts)
  const topPosts = [...initialPosts]
    .sort((a, b) => {
      const aEng = (Number(a.metrics?.reactions) || 0) + (Number(a.metrics?.clicks) || 0) + (Number(a.metrics?.reposts) || 0)
      const bEng = (Number(b.metrics?.reactions) || 0) + (Number(b.metrics?.clicks) || 0) + (Number(b.metrics?.reposts) || 0)
      return bEng - aEng
    })
    .slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex items-center justify-between gap-4">
        <div>
          {syncError && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle size={12} />
              {syncError}
            </p>
          )}
        </div>
        <Button
          size="sm"
          onClick={handleSync}
          loading={syncing}
          className="gap-2 shrink-0 bg-ms-blue hover:bg-ms-blue-dark"
        >
          <RefreshCw size={14} className={cn(syncing && 'animate-spin')} />
          {syncing ? 'Syncing...' : 'Sync Metrics'}
        </Button>
      </div>

      {/* Aggregate Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<ThumbsUp size={18} className="text-blue-600" />}
          label="Total Likes/Reactions"
          value={totalReactions}
          bg="bg-blue-50"
        />
        <StatCard
          icon={<MousePointerClick size={18} className="text-green-600" />}
          label="Link Clicks"
          value={totalClicks}
          bg="bg-green-50"
        />
        <StatCard
          icon={<Share2 size={18} className="text-purple-600" />}
          label="Shares / Reposts"
          value={totalReposts}
          bg="bg-purple-50"
        />
        <StatCard
          icon={<MessageSquare size={18} className="text-amber-600" />}
          label="Comments"
          value={totalComments}
          bg="bg-amber-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Performance breakdowns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Platform performance */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <TrendingUp size={16} className="text-ms-blue" />
                Platform Performance
              </h3>
            </CardHeader>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100">
                      <th className="px-5 py-3 font-semibold text-gray-600">Platform</th>
                      <th className="px-5 py-3 font-semibold text-gray-600 text-center">Posts</th>
                      <th className="px-5 py-3 font-semibold text-gray-600 text-center">Avg Likes</th>
                      <th className="px-5 py-3 font-semibold text-gray-600 text-center">Avg Clicks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(Object.keys(platformBreakdown) as Platform[]).map((plat) => {
                      const stats = platformBreakdown[plat]
                      const avgLikes = stats.posts > 0 ? (stats.reactions / stats.posts).toFixed(1) : '0'
                      const avgClicks = stats.posts > 0 ? (stats.clicks / stats.posts).toFixed(1) : '0'

                      return (
                        <tr key={plat} className="hover:bg-gray-50/40">
                          <td className="px-5 py-3 font-medium text-gray-800 capitalize">
                            <span className={cn('px-2 py-0.5 rounded text-xs font-semibold mr-2 text-white', PLATFORM_COLORS[plat])}>
                              {PLATFORM_LABELS[plat]}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-gray-600 text-center">{stats.posts}</td>
                          <td className="px-5 py-3 text-gray-600 text-center">{avgLikes}</td>
                          <td className="px-5 py-3 text-gray-600 text-center">{avgClicks}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          {/* Tone performance */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <FileText size={16} className="text-purple-600" />
                Tone Performance
              </h3>
            </CardHeader>
            <CardBody className="p-0">
              {Object.keys(toneBreakdown).length === 0 ? (
                <div className="py-8 text-center text-gray-400 text-sm">
                  No tone data available
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-100">
                        <th className="px-5 py-3 font-semibold text-gray-600">Tone</th>
                        <th className="px-5 py-3 font-semibold text-gray-600 text-center">Posts</th>
                        <th className="px-5 py-3 font-semibold text-gray-600 text-center">Avg Likes</th>
                        <th className="px-5 py-3 font-semibold text-gray-600 text-center">Avg Clicks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {Object.entries(toneBreakdown).map(([tone, stats]) => {
                        const emoji = TONE_EMOJIS[tone as Tone] || '✨'
                        const avgLikes = stats.posts > 0 ? (stats.reactions / stats.posts).toFixed(1) : '0'
                        const avgClicks = stats.posts > 0 ? (stats.clicks / stats.posts).toFixed(1) : '0'

                        return (
                          <tr key={tone} className="hover:bg-gray-50/40">
                            <td className="px-5 py-3 font-medium text-gray-800 capitalize">
                              <span className="mr-1.5">{emoji}</span>
                              {tone}
                            </td>
                            <td className="px-5 py-3 text-gray-600 text-center">{stats.posts}</td>
                            <td className="px-5 py-3 text-gray-600 text-center">{avgLikes}</td>
                            <td className="px-5 py-3 text-gray-600 text-center">{avgClicks}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Top posts */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-gray-800">Top Performing Posts</h3>
            </CardHeader>
            <CardBody className="p-0">
              {topPosts.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-sm">
                  Top performing posts will show here once synced
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {topPosts.map((post) => {
                    const engagement =
                      (Number(post.metrics?.reactions) || 0) +
                      (Number(post.metrics?.clicks) || 0) +
                      (Number(post.metrics?.reposts) || 0)
                    
                    return (
                      <li key={post.id} className="px-5 py-4 hover:bg-gray-50/30 transition">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1.5 min-w-0">
                            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
                              {post.brief?.topic}
                            </p>
                            <p className="text-sm text-gray-800 line-clamp-2 leading-relaxed">
                              {post.content}
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={cn('text-[10px]', PLATFORM_COLORS[post.platform as Platform])}>
                                {PLATFORM_LABELS[post.platform as Platform]}
                              </Badge>
                              {post.brief?.tone && (
                                <span className="text-xs text-gray-400 capitalize">
                                  {TONE_EMOJIS[post.brief.tone]} {post.brief.tone} Tone
                                </span>
                              )}
                              {post.profile && (
                                <span className="text-xs text-gray-400">
                                  By {post.profile.full_name || post.profile.email}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 text-right space-y-1">
                            <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-bold px-2 py-0.5 rounded-lg border border-green-100">
                              <ThumbsUp size={11} />
                              {engagement} Engagement
                            </span>
                            <div className="text-[10px] text-gray-400">
                              {post.metrics?.clicks || 0} clicks · {post.metrics?.reactions || 0} likes
                            </div>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Right column: AI recommendations */}
        <div className="space-y-6">
          <Card className="border-purple-100 shadow-md shadow-purple-500/5">
            <CardHeader className="bg-purple-50/30 border-b border-purple-100 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                <Sparkles size={14} />
              </div>
              <h3 className="font-semibold text-purple-900">AI Copywriting Insights</h3>
            </CardHeader>
            <CardBody className="py-4">
              {loadingInsights ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3">
                  <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
                  <p className="text-xs text-purple-600 font-medium">Deepseek is analyzing stats...</p>
                </div>
              ) : insights ? (
                <div className="prose prose-sm max-w-none text-gray-700 space-y-3 prose-headings:text-purple-950 prose-headings:font-bold prose-headings:text-sm prose-ul:list-disc prose-ul:pl-4">
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">
                    {insights}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                  <HelpCircle size={24} className="text-purple-300 mb-2" />
                  <p className="text-xs text-gray-500">No suggestions available</p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  bg,
}: {
  icon: React.ReactNode
  label: string
  value: number
  bg: string
}) {
  return (
    <Card>
      <div className="px-5 py-4">
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-3', bg)}>
          {icon}
        </div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </Card>
  )
}
