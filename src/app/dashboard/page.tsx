export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import {
  PLATFORM_LABELS,
  PLATFORM_COLORS,
  POST_STATUS_COLORS,
  POST_STATUS_LABELS,
  BRIEF_STATUS_LABELS,
  formatDateTime,
  truncate,
  cn,
} from '@/lib/utils'
import { Platform, BriefStatus, PostStatus } from '@/types/database'
import {
  PenSquare,
  Send,
  CheckCircle2,
  Clock,
  TrendingUp,
  ChevronRight,
  Sparkles,
} from 'lucide-react'

export const metadata = { title: 'Dashboard — Modeshare' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?error=' + encodeURIComponent('No user session in DashboardPage'))

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const isApprover = profile?.role !== 'creator'

  // Stats queries
  const [
    { count: myBriefsCount },
    { count: myPostsCount },
    { count: pendingApprovalCount },
    { count: scheduledCount },
    { count: publishedCount },
  ] = await Promise.all([
    supabase
      .from('briefs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_review'),
    supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'scheduled'),
    supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published'),
  ])

  // Recent briefs (own)
  const { data: recentBriefs } = await supabase
    .from('briefs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  // Pending posts (for approvers) or own pending (for creators)
  const pendingQuery = supabase
    .from('posts')
    .select('*, brief:briefs(topic)')
    .eq('status', 'pending_review')
    .order('created_at', { ascending: true })
    .limit(5)

  const { data: pendingPosts } = isApprover
    ? await pendingQuery
    : await pendingQuery.eq('user_id', user.id)

  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  const BRIEF_STATUS_COLORS: Record<BriefStatus, string> = {
    pending_generation: 'bg-gray-100 text-gray-500',
    generated: 'bg-blue-100 text-blue-700',
    in_review: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Good {getTimeOfDay()}, {firstName} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Here&apos;s what&apos;s happening with your content today.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<PenSquare size={18} className="text-ms-blue" />}
          label="My Briefs"
          value={myBriefsCount ?? 0}
          bg="bg-ms-blue/5"
        />
        <StatCard
          icon={<Sparkles size={18} className="text-purple-600" />}
          label="Posts Generated"
          value={myPostsCount ?? 0}
          bg="bg-purple-50"
        />
        <StatCard
          icon={<Clock size={18} className="text-amber-600" />}
          label={isApprover ? 'Awaiting Approval' : 'Pending Review'}
          value={isApprover ? (pendingApprovalCount ?? 0) : (pendingPosts?.length ?? 0)}
          bg="bg-amber-50"
          href={isApprover ? '/dashboard/approvals' : undefined}
          alert={isApprover && (pendingApprovalCount ?? 0) > 0}
        />
        <StatCard
          icon={<Send size={18} className="text-green-600" />}
          label="Scheduled"
          value={scheduledCount ?? 0}
          bg="bg-green-50"
          href="/dashboard/calendar"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent briefs */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">Recent Briefs</h2>
              <Link
                href="/dashboard/briefs"
                className="text-xs text-ms-blue hover:text-ms-blue-dark flex items-center gap-1"
              >
                View all <ChevronRight size={12} />
              </Link>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {!recentBriefs?.length ? (
              <div className="flex flex-col items-center py-10 text-center px-6">
                <PenSquare size={20} className="text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">No briefs yet</p>
                <Link href="/dashboard/briefs/new" className="mt-3">
                  <Button size="sm">Create brief</Button>
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {recentBriefs.map((brief) => (
                  <li key={brief.id}>
                    <Link
                      href={`/dashboard/briefs/${brief.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {brief.topic}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400">
                            {formatDateTime(brief.created_at)}
                          </span>
                          <div className="flex gap-1">
                            {(brief.platforms as Platform[]).map((p) => (
                              <Badge key={p} className={cn(PLATFORM_COLORS[p], 'text-[10px]')}>
                                {PLATFORM_LABELS[p]}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <Badge className={BRIEF_STATUS_COLORS[brief.status as BriefStatus]}>
                        {BRIEF_STATUS_LABELS[brief.status as BriefStatus]}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Pending review */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">
                {isApprover ? 'Needs Approval' : 'My Pending Posts'}
              </h2>
              {isApprover && (
                <Link
                  href="/dashboard/approvals"
                  className="text-xs text-ms-blue hover:text-ms-blue-dark flex items-center gap-1"
                >
                  Review all <ChevronRight size={12} />
                </Link>
              )}
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {!pendingPosts?.length ? (
              <div className="flex flex-col items-center py-10 text-center px-6">
                <CheckCircle2 size={20} className="text-green-400 mb-2" />
                <p className="text-sm text-gray-400">
                  {isApprover ? 'Nothing to review — all clear!' : 'No posts pending review'}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {pendingPosts.map((post) => (
                  <li key={post.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {(post.brief as { topic: string })?.topic}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {truncate(post.content, 80)}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={cn(PLATFORM_COLORS[post.platform as Platform], 'text-[10px]')}>
                            {PLATFORM_LABELS[post.platform as Platform]}
                          </Badge>
                          <span className="text-xs text-gray-400">
                            Variant {post.variant_index}
                          </span>
                        </div>
                      </div>
                      <Badge className={POST_STATUS_COLORS[post.status as PostStatus]}>
                        {POST_STATUS_LABELS[post.status as PostStatus]}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Published count banner */}
      {(publishedCount ?? 0) > 0 && (
        <Card>
          <div className="px-6 py-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
              <TrendingUp size={18} className="text-purple-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-800">
                {publishedCount} post{publishedCount !== 1 ? 's' : ''} published
              </p>
              <p className="text-xs text-gray-500">Total posts sent to social media via Buffer</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  bg,
  href,
  alert,
}: {
  icon: React.ReactNode
  label: string
  value: number
  bg: string
  href?: string
  alert?: boolean
}) {
  const inner = (
    <Card className={cn('relative', href && 'hover:border-ms-blue/40 transition cursor-pointer')}>
      <div className="px-5 py-4">
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-3', bg)}>
          {icon}
        </div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        {alert && value > 0 && (
          <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-ms-red animate-pulse" />
        )}
      </div>
    </Card>
  )

  return href ? <Link href={href}>{inner}</Link> : inner
}

function getTimeOfDay(): string {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
