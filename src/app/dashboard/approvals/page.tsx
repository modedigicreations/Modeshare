export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ClipboardCheck } from 'lucide-react'
import { Post, Profile } from '@/types/database'
import ApprovalsClient from './ApprovalsClient'

export const metadata = { title: 'Approvals — Modeshare' }

export default async function ApprovalsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Creators can't access this page
  if (!profile || profile.role === 'creator') redirect('/dashboard')

  // Fetch all pending_review posts with brief and author info
  const { data: posts } = await supabase
    .from('posts')
    .select(`
      *,
      brief:briefs(topic, tone, target_date, platforms),
      profile:profiles!posts_user_id_fkey(full_name, email)
    `)
    .eq('status', 'pending_review')
    .order('created_at', { ascending: true })

  const pendingCount = posts?.length || 0

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-ms-blue/10 flex items-center justify-center">
          <ClipboardCheck size={20} className="text-ms-blue" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Approvals Queue</h1>
          <p className="text-sm text-gray-500">
            {pendingCount} post{pendingCount !== 1 ? 's' : ''} awaiting review
          </p>
        </div>
      </div>

      <ApprovalsClient
        initialPosts={(posts as (Post & { brief: { topic: string; tone: string; target_date: string | null; platforms: string[] }; profile: { full_name: string | null; email: string } })[]) || []}
        reviewerId={user.id}
      />
    </div>
  )
}
