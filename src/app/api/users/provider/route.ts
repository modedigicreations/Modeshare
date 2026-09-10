import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const providerSchema = z.object({
  facebook_provider: z.enum(['buffer', 'facebook_api']),
})

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const parsed = providerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid provider value. Must be buffer or facebook_api.' }, { status: 400 })
    }

    const { facebook_provider } = parsed.data

    // If switching to facebook_api, verify that user has connected Facebook
    if (facebook_provider === 'facebook_api') {
      const { data: fbConn } = await supabase
        .from('facebook_connections')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!fbConn) {
        return NextResponse.json(
          { error: 'Please connect your Facebook Page before activating direct Facebook API scheduling.' },
          { status: 400 }
        )
      }
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ facebook_provider })
      .eq('id', user.id)

    if (updateError) {
      throw new Error(updateError.message)
    }

    return NextResponse.json({
      success: true,
      facebook_provider,
    })
  } catch (err) {
    console.error('Update provider error:', err)
    const msg = err instanceof Error ? err.message : 'Failed to update publishing provider'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
