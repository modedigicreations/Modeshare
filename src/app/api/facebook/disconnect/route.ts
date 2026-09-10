import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase
      .from('facebook_connections')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      throw new Error(error.message)
    }

    // Also reset provider to 'buffer' if it was 'facebook_api'
    await supabase
      .from('profiles')
      .update({ facebook_provider: 'buffer' })
      .eq('id', user.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Facebook disconnect error:', err)
    const msg = err instanceof Error ? err.message : 'Failed to disconnect Facebook'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
