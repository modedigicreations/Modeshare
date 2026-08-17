export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import {
  PLATFORM_COLORS,
  PLATFORM_LABELS,
  BRIEF_STATUS_LABELS,
  formatDate,
  cn,
} from '@/lib/utils'
import { Platform, BriefStatus } from '@/types/database'
import { PenSquare, ChevronRight, Calendar } from 'lucide-react'

const STATUS_COLORS: Record<BriefStatus, string> = {
  pending_generation: 'bg-gray-100 text-gray-600',
  generated: 'bg-blue-100 text-blue-700',
  in_review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

export const metadata = { title: 'My Briefs — Modeshare' }

export default async function BriefsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // Approvers/admins see all briefs; creators see only their own
  let query = supabase
    .from('briefs')
    .select('*')
    .order('created_at', { ascending: false })

  if (profile?.role === 'creator') {
    query = query.eq('user_id', user.id)
  }

  const { data: briefs } = await query

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {profile?.role === 'creator' ? 'My Briefs' : 'All Briefs'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {briefs?.length || 0} brief{briefs?.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <Link href="/dashboard/briefs/new">
          <Button size="sm">
            <PenSquare size={14} />
            New Brief
          </Button>
        </Link>
      </div>

      {!briefs?.length ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
              <PenSquare size={24} className="text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-700 mb-1">No briefs yet</h3>
            <p className="text-sm text-gray-500 mb-4">
              Submit a brief to have AI generate your social posts
            </p>
            <Link href="/dashboard/briefs/new">
              <Button size="sm">Create your first brief</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {briefs.map((brief) => (
            <Link key={brief.id} href={`/dashboard/briefs/${brief.id}`}>
              <Card className="hover:border-ms-blue/40 transition cursor-pointer">
                <div className="px-5 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-gray-900 truncate">{brief.topic}</p>
                      <Badge className={cn(STATUS_COLORS[brief.status as BriefStatus])}>
                        {BRIEF_STATUS_LABELS[brief.status as BriefStatus]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs text-gray-400 capitalize">
                        {brief.tone} tone
                      </span>
                      {brief.target_date && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Calendar size={11} />
                          {formatDate(brief.target_date)}
                        </span>
                      )}
                      <div className="flex gap-1">
                        {(brief.platforms as Platform[]).map((p) => (
                          <Badge key={p} className={cn(PLATFORM_COLORS[p], 'text-[10px]')}>
                            {PLATFORM_LABELS[p]}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 shrink-0">
                    <span>{formatDate(brief.created_at)}</span>
                    <ChevronRight size={16} />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
