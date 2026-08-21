export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Post, UserRole } from '@/types/database'
import CalendarClient from './CalendarClient'

export const metadata = { title: 'Calendar — Modeshare' }

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?error=' + encodeURIComponent('No user session in CalendarPage'))

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // Fetch scheduled and published posts
  let query = supabase
    .from('posts')
    .select('*, brief:briefs(topic)')
    .in('status', ['approved', 'scheduled', 'published'])
    .order('scheduled_at', { ascending: true })

  if (profile?.role === 'creator') {
    query = query.eq('user_id', user.id)
  }

  const { data: posts } = await query

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Content Calendar</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Approved, scheduled, and published posts
        </p>
      </div>
      <CalendarClient
        posts={(posts as (Post & { brief: { topic: string } })[]) || []}
        userRole={profile?.role as UserRole}
      />
    </div>
  )
}
