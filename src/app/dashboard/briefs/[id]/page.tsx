export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import {
  PLATFORM_LABELS,
  PLATFORM_COLORS,
  POST_STATUS_LABELS,
  POST_STATUS_COLORS,
  formatDate,
  cn,
} from '@/lib/utils'
import { Calendar, Sparkles } from 'lucide-react'
import { Platform } from '@/types/database'
import Link from 'next/link'
import Button from '@/components/ui/Button'

function PlatformIcon({ platform }: { platform: Platform }) {
  const map: Record<Platform, { letter: string; bg: string }> = {
    facebook: { letter: 'f', bg: 'bg-blue-600' },
    twitter: { letter: 'X', bg: 'bg-slate-800' },
    linkedin: { letter: 'in', bg: 'bg-blue-800' },
  }
  const { letter, bg } = map[platform]
  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded text-white text-[10px] font-bold ${bg}`}
    >
      {letter}
    </span>
  )
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function BriefDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const { data: brief } = await supabase
    .from('briefs')
    .select('*')
    .eq('id', id)
    .single()

  if (!brief) notFound()

  // Creators can only see their own briefs
  if (brief.user_id !== user.id && profile?.role === 'creator') notFound()

  const { data: posts } = await supabase
    .from('posts')
    .select('*')
    .eq('brief_id', id)
    .order('platform')
    .order('variant_index')

  // Group posts by platform
  const byPlatform = (posts || []).reduce<Record<Platform, typeof posts>>((acc, post) => {
    if (!acc[post.platform as Platform]) acc[post.platform as Platform] = []
    acc[post.platform as Platform]!.push(post)
    return acc
  }, {} as Record<Platform, typeof posts>)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/dashboard/briefs" className="hover:text-ms-blue">
              My Briefs
            </Link>
            <span>/</span>
            <span className="text-gray-800 font-medium truncate max-w-xs">{brief.topic}</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">{brief.topic}</h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {brief.target_date && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Calendar size={12} />
                {formatDate(brief.target_date)}
              </span>
            )}
            <span className="text-xs text-gray-400 capitalize">Tone: {brief.tone}</span>
            <div className="flex gap-1.5">
              {(brief.platforms as Platform[]).map((p) => (
                <Badge key={p} className={PLATFORM_COLORS[p]}>
                  {PLATFORM_LABELS[p]}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        {profile?.role !== 'creator' && (
          <Link href="/dashboard/approvals">
            <Button variant="outline" size="sm">
              View Approvals Queue
            </Button>
          </Link>
        )}
      </div>

      {/* Posts by platform */}
      {(brief.platforms as Platform[]).map((platform) => {
        const platformPosts = byPlatform[platform] || []

        return (
          <Card key={platform}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <PlatformIcon platform={platform} />
                <h2 className="font-semibold text-gray-800">{PLATFORM_LABELS[platform]}</h2>
                <span className="text-xs text-gray-400">
                  {platformPosts.length} variant{platformPosts.length !== 1 ? 's' : ''}
                </span>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              {platformPosts.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                  <Sparkles size={14} />
                  No posts generated yet
                </div>
              ) : (
                platformPosts.map((post) => (
                  <div
                    key={post.id}
                    className="border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <span className="text-xs font-medium text-gray-500">
                        Variant {post.variant_index}
                      </span>
                      <Badge className={cn(POST_STATUS_COLORS[post.status as keyof typeof POST_STATUS_COLORS])}>
                        {POST_STATUS_LABELS[post.status as keyof typeof POST_STATUS_LABELS]}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {post.content}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        {post.content.length} chars
                      </span>
                      {post.reviewer_note && (
                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                          Note: {post.reviewer_note}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        )
      })}
    </div>
  )
}
