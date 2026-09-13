import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : supabase
    const { error } = await db
      .from('linkedin_connections')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      throw new Error(error.message)
    }

    // Reset linkedin_provider to buffer if it was linkedin_api
    await db
      .from('profiles')
      .update({ linkedin_provider: 'buffer' })
      .eq('id', user.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('LinkedIn disconnect error:', err)
    const msg = err instanceof Error ? err.message : 'Failed to disconnect LinkedIn account'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
