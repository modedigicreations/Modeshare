export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardLayoutClient from '@/components/layout/DashboardLayoutClient'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?error=' + encodeURIComponent(`Auth error in DashboardLayout: ${authError?.message || 'No user session'}`))
  }

  const { data: initialProfile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  let profile = initialProfile

  // Profile may not exist yet if the DB trigger hasn't fired — create it inline
  if (!profile) {
    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email!,
        full_name: user.user_metadata?.full_name || '',
        role: 'creator',
      })
      .select()
      .single()

    if (insertError) {
      redirect('/login?error=' + encodeURIComponent(`Profile inline insert failed: ${insertError.message}. Fetch error: ${profileError?.message || 'None'}`))
    }

    profile = newProfile
  }

  // If still no profile something is structurally wrong — redirect cleanly
  if (!profile) {
    redirect('/login?error=' + encodeURIComponent(`No profile found for user ${user.email} after insert attempt`))
  }

  return (
    <DashboardLayoutClient role={profile.role} profile={profile}>
      {children}
    </DashboardLayoutClient>
  )
}
