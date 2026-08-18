export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  let { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Profile may not exist yet if the DB trigger hasn't fired — create it inline
  if (!profile) {
    const { data: newProfile } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email!,
        full_name: user.user_metadata?.full_name || '',
        role: 'creator',
      })
      .select()
      .single()

    profile = newProfile
  }

  // If still no profile something is structurally wrong — redirect cleanly
  if (!profile) redirect('/login')

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar role={profile.role} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar profile={profile} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
