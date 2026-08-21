import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Post, Tone } from '@/types/database'
import AnalyticsClient from './AnalyticsClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Analytics — Modeshare' }

type EnrichedPost = Omit<Post, 'brief' | 'profile'> & {
  brief?: { topic: string; tone: Tone }
  profile?: { full_name: string | null; email: string }
}

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?error=' + encodeURIComponent('No user session in AnalyticsPage'))

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isSuperAdmin = profile?.role === 'super_admin'

  // Fetch all posts pushed to Buffer
  let query = supabase
    .from('posts')
    .select(`
      *,
      brief:briefs(topic, tone),
      profile:profiles!posts_user_id_fkey(full_name, email)
    `)
    .not('buffer_post_id', 'is', null)

  if (!isSuperAdmin) {
    query = query.eq('user_id', user.id)
  }

  const { data: posts } = await query

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          {isSuperAdmin ? 'Team Performance Analytics' : 'My Performance Analytics'}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Performance metrics synced directly from your Buffer connections
        </p>
      </div>

      <AnalyticsClient initialPosts={(posts as EnrichedPost[]) || []} />
    </div>
  )
}
