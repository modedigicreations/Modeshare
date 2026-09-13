import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const providerSchema = z.object({
  facebook_provider: z.enum(['buffer', 'facebook_api']).optional(),
  twitter_provider: z.enum(['buffer', 'twitter_api']).optional(),
  linkedin_provider: z.enum(['buffer', 'linkedin_api']).optional(),
})

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const parsed = providerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid provider configuration.' }, { status: 400 })
    }

    const { facebook_provider, twitter_provider, linkedin_provider } = parsed.data
    const updateData: Record<string, string> = {}
    const db = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : supabase

    // 1. Facebook verification
    if (facebook_provider) {
      if (facebook_provider === 'facebook_api') {
        const { data: fbConn } = await db
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
      updateData.facebook_provider = facebook_provider
    }

    // 2. Twitter verification
    if (twitter_provider) {
      if (twitter_provider === 'twitter_api') {
        const { data: twConn } = await db
          .from('twitter_connections')
          .select('id')
          .eq('user_id', user.id)
          .single()

        if (!twConn) {
          return NextResponse.json(
            { error: 'Please connect your Twitter / X account before activating direct Twitter API publishing.' },
            { status: 400 }
          )
        }
      }
      updateData.twitter_provider = twitter_provider
    }

    // 3. LinkedIn verification
    if (linkedin_provider) {
      if (linkedin_provider === 'linkedin_api') {
        const { data: liConn } = await db
          .from('linkedin_connections')
          .select('id')
          .eq('user_id', user.id)
          .single()

        if (!liConn) {
          return NextResponse.json(
            { error: 'Please connect your LinkedIn account before activating direct LinkedIn API publishing.' },
            { status: 400 }
          )
        }
      }
      updateData.linkedin_provider = linkedin_provider
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No provider specified to update' }, { status: 400 })
    }

    const { error: updateError } = await db
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)

    if (updateError) {
      throw new Error(updateError.message)
    }

    return NextResponse.json({
      success: true,
      ...updateData,
    })
  } catch (err) {
    console.error('Update provider error:', err)
    const msg = err instanceof Error ? err.message : 'Failed to update publishing provider'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

