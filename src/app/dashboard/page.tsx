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

  const isSuperAdmin = profile?.role === 'super_admin'
  const isApprover = profile?.role !== 'creator'

  // Stats queries
  let briefsQuery = supabase
    .from('briefs')
    .select('*', { count: 'exact', head: true })
  
  let postsQuery = supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })

  if (!isSuperAdmin) {
    briefsQuery = briefsQuery.eq('user_id', user.id)
    postsQuery = postsQuery.eq('user_id', user.id)
  }

  const [
    { count: briefsCount },
    { count: postsCount },
    { count: pendingApprovalCount },
    { count: scheduledCount },
    { count: publishedCount },
  ] = await Promise.all([
    briefsQuery,
    postsQuery,
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

  // Recent briefs
  let recentBriefsQuery = supabase.from('briefs').select('*')
  if (!isSuperAdmin) {
    recentBriefsQuery = recentBriefsQuery.eq('user_id', user.id)
  }
  const { data: recentBriefs } = await recentBriefsQuery
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
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Welcome Hero Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-ms-blue-dark via-ms-blue to-[#001f5c] p-6 sm:p-8 text-white shadow-lg shadow-ms-blue/15 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="relative z-10 space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 backdrop-blur-md text-blue-100 border border-white/10">
            <Sparkles size={12} className="text-amber-300 animate-pulse" />
            AI Marketing Suite
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Good {getTimeOfDay()}, {firstName} 👋
          </h1>
          <p className="text-blue-100 text-sm max-w-md">
            Draft topics, generate high-impact platform variants, and publish instantly through Buffer.
          </p>
        </div>
        <div className="relative z-10 shrink-0 flex gap-3">
          <Link href="/dashboard/briefs/new">
            <Button variant="primary" className="bg-ms-red hover:bg-ms-red-dark hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-md shadow-ms-red/20 font-semibold px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 border-0">
              <PenSquare size={16} />
              Create New Brief
            </Button>
          </Link>
        </div>
        {/* Decorative ambient background blur lights */}
        <div className="absolute right-0 bottom-0 w-64 h-64 bg-ms-red/10 rounded-full blur-3xl translate-x-12 translate-y-12 pointer-events-none" />
        <div className="absolute left-1/3 top-0 w-32 h-32 bg-blue-400/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          icon={<PenSquare size={20} />}
          label={isSuperAdmin ? 'All Briefs' : 'My Briefs'}
          value={briefsCount ?? 0}
          bg="bg-blue-50 border-blue-100/50 text-blue-600"
        />
        <StatCard
          icon={<Sparkles size={20} />}
          label={isSuperAdmin ? 'All Posts Generated' : 'Posts Generated'}
          value={postsCount ?? 0}
          bg="bg-purple-50 border-purple-100/50 text-purple-600"
        />
        <StatCard
          icon={<Clock size={20} />}
          label={isApprover ? 'Awaiting Approval' : 'Pending Review'}
          value={isApprover ? (pendingApprovalCount ?? 0) : (pendingPosts?.length ?? 0)}
          bg="bg-amber-50 border-amber-100/50 text-amber-600"
          href={isApprover ? '/dashboard/approvals' : undefined}
          alert={isApprover && (pendingApprovalCount ?? 0) > 0}
        />
        <StatCard
          icon={<Send size={20} />}
          label="Scheduled"
          value={scheduledCount ?? 0}
          bg="bg-green-50 border-green-100/50 text-green-600"
          href="/dashboard/calendar"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent briefs */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-800">Recent Briefs</h2>
              <Link
                href="/dashboard/briefs"
                className="text-xs font-semibold text-ms-blue hover:text-ms-blue-dark flex items-center gap-1 transition-colors"
              >
                View all <ChevronRight size={12} />
              </Link>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {!recentBriefs?.length ? (
              <div className="flex flex-col items-center py-12 text-center px-6">
                <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                  <PenSquare size={20} className="text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-400">No briefs created yet</p>
                <Link href="/dashboard/briefs/new" className="mt-4">
                  <Button size="sm" className="rounded-xl px-4 font-semibold shadow-sm">Create brief</Button>
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentBriefs.map((brief) => (
                  <li key={brief.id} className="first:rounded-t-2xl last:rounded-b-2xl overflow-hidden">
                    <Link
                      href={`/dashboard/briefs/${brief.id}`}
                      className="flex items-center justify-between gap-4 px-6 py-4.5 hover:bg-slate-50/70 border-l-2 border-transparent hover:border-ms-blue transition-all duration-200 group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 truncate group-hover:text-ms-blue transition-colors duration-150">
                          {brief.topic}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-xs text-slate-400 font-medium">
                            {formatDateTime(brief.created_at)}
                          </span>
                          <div className="flex gap-1.5">
                            {(brief.platforms as Platform[]).map((p) => (
                              <Badge key={p} className={cn(PLATFORM_COLORS[p], 'text-[10px] font-semibold px-2 py-0.5 rounded-md shadow-xs')}>
                                {PLATFORM_LABELS[p]}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={cn(BRIEF_STATUS_COLORS[brief.status as BriefStatus], 'font-semibold px-2.5 py-0.5 rounded-full')}>
                          {BRIEF_STATUS_LABELS[brief.status as BriefStatus]}
                        </Badge>
                        <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-400 transition-transform group-hover:translate-x-0.5 duration-200 shrink-0" />
                      </div>
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
              <h2 className="font-bold text-slate-800">
                {isApprover ? 'Needs Approval' : 'My Pending Posts'}
              </h2>
              {isApprover && (
                <Link
                  href="/dashboard/approvals"
                  className="text-xs font-semibold text-ms-blue hover:text-ms-blue-dark flex items-center gap-1 transition-colors"
                >
                  Review all <ChevronRight size={12} />
                </Link>
              )}
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {!pendingPosts?.length ? (
              <div className="flex flex-col items-center py-12 text-center px-6">
                <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-3">
                  <CheckCircle2 size={20} className="text-green-500" />
                </div>
                <p className="text-sm font-medium text-slate-400">
                  {isApprover ? 'Nothing to review — all clear!' : 'No posts pending review'}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {pendingPosts.map((post) => (
                  <li key={post.id} className="first:rounded-t-2xl last:rounded-b-2xl overflow-hidden">
                    <div className="flex items-center justify-between gap-4 px-6 py-4.5 hover:bg-slate-50/50 border-l-2 border-transparent hover:border-amber-500 transition-all duration-200 group">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-700 truncate">
                          {(post.brief as { topic: string })?.topic}
                        </p>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-1 italic">
                          &ldquo;{truncate(post.content, 90)}&rdquo;
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <Badge className={cn(PLATFORM_COLORS[post.platform as Platform], 'text-[10px] font-semibold px-2 py-0.5 rounded-md shadow-xs')}>
                            {PLATFORM_LABELS[post.platform as Platform]}
                          </Badge>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded-md">
                            Variant {post.variant_index}
                          </span>
                        </div>
                      </div>
                      <Badge className={cn(POST_STATUS_COLORS[post.status as PostStatus], 'font-semibold px-2.5 py-0.5 rounded-full shrink-0')}>
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
        <Card className="overflow-hidden border-l-4 border-l-purple-600 bg-gradient-to-r from-purple-50/50 to-transparent">
          <div className="px-6 py-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-purple-100/80 flex items-center justify-center shrink-0 shadow-sm">
              <TrendingUp size={20} className="text-purple-700" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-base">
                {publishedCount} post{publishedCount !== 1 ? 's' : ''} published
              </p>
              <p className="text-xs font-medium text-slate-400 mt-0.5">Total social media updates published via Buffer connection.</p>
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
    <Card className={cn(
      'relative group overflow-hidden border border-slate-200/50 hover:border-slate-300/80 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-default',
      href && 'cursor-pointer hover:border-ms-blue/30'
    )}>
      <div className="px-5 py-5 flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-extrabold text-slate-800 tracking-tight transition-all group-hover:scale-105 origin-left duration-300">{value}</p>
        </div>
        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300 shadow-xs border border-slate-200/20', bg)}>
          {icon}
        </div>
      </div>
      {alert && value > 0 && (
        <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-ms-red animate-pulse shadow-md shadow-ms-red/50" />
      )}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-transparent to-slate-500/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
    </Card>
  )

  return href ? <Link href={href} className="block">{inner}</Link> : inner
}

function getTimeOfDay(): string {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
