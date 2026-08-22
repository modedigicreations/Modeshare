import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import UsersClient from './UsersClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Users Management — Modeshare' }

export default async function UsersPage() {
  const supabase = await createClient()

  // 1. Authenticate user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?error=' + encodeURIComponent('No user session in UsersPage'))

  // 2. Authorize user (restricted to super_admin only)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') {
    redirect('/dashboard?error=' + encodeURIComponent('Super Admin permissions required to view that page.'))
  }

  // 3. Fetch all user profiles
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (profilesError) {
    throw new Error(`Failed to load users: ${profilesError.message}`)
  }

  // 4. Fetch buffer connection statuses
  const { data: connections } = await supabase
    .from('buffer_connections')
    .select('user_id, profile_ids')

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Users Management</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage roles, view connected accounts, and monitor team status.
        </p>
      </div>

      <UsersClient
        currentUserId={user.id}
        initialProfiles={profiles || []}
        initialConnections={connections || []}
      />
    </div>
  )
}
