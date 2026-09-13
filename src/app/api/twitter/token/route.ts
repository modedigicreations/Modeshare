import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveTwitterConnection } from '@/lib/twitter'
import { z } from 'zod'

const tokenSchema = z.object({
  accessToken: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const parsed = tokenSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Missing access token' }, { status: 400 })
    }

    const { accessToken } = parsed.data

    // Validate token and fetch Twitter profile
    const twitterUser = await resolveTwitterConnection(accessToken)

    // Upsert into twitter_connections using admin client or server client
    const db = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : supabase
    const { error: upsertError } = await db.from('twitter_connections').upsert(
      {
        user_id: user.id,
        access_token: accessToken.trim(),
        twitter_user_id: twitterUser.id,
        twitter_username: twitterUser.username,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    if (upsertError) {
      throw new Error(`Database upsert failed: ${upsertError.message}`)
    }

    return NextResponse.json({
      success: true,
      user: twitterUser,
    })
  } catch (err) {
    console.error('Twitter manual token connect error:', err)
    const msg = err instanceof Error ? err.message : 'Failed to connect Twitter account'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
