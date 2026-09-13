import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exchangeTwitterCode } from '@/lib/twitter'
import { getAppOrigin } from '@/lib/utils'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const origin = getAppOrigin(request)
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      const errorDesc = searchParams.get('error_description') || error
      console.error('Twitter OAuth error param:', errorDesc)
      return NextResponse.redirect(
        `${origin}/dashboard/settings?error=twitter_auth_failed&details=${encodeURIComponent(errorDesc)}`
      )
    }

    if (!code) {
      return NextResponse.redirect(`${origin}/dashboard/settings?error=twitter_no_code`)
    }

    const cookieStore = await cookies()
    const storedState = cookieStore.get('twitter_oauth_state')?.value
    const codeVerifier = cookieStore.get('twitter_code_verifier')?.value

    if (!storedState || !state || storedState !== state) {
      return NextResponse.redirect(`${origin}/dashboard/settings?error=twitter_state_mismatch`)
    }

    if (!codeVerifier) {
      return NextResponse.redirect(`${origin}/dashboard/settings?error=twitter_verifier_missing`)
    }

    cookieStore.delete('twitter_oauth_state')
    cookieStore.delete('twitter_code_verifier')

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.redirect(`${origin}/login?error=session_expired`)
    }

    const tokenResult = await exchangeTwitterCode(code, codeVerifier, origin)

    let expiresAt: string | null = null
    if (tokenResult.expiresIn) {
      expiresAt = new Date(Date.now() + tokenResult.expiresIn * 1000).toISOString()
    }

    // Upsert into twitter_connections
    const db = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : supabase
    const { error: upsertErr } = await db.from('twitter_connections').upsert(
      {
        user_id: user.id,
        access_token: tokenResult.accessToken,
        refresh_token: tokenResult.refreshToken || null,
        expires_at: expiresAt,
        twitter_user_id: tokenResult.user.id,
        twitter_username: tokenResult.user.username,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    if (upsertErr) {
      console.error('Supabase twitter_connections upsert error:', upsertErr)
      return NextResponse.redirect(
        `${origin}/dashboard/settings?error=twitter_db_failed&details=${encodeURIComponent(upsertErr.message)}`
      )
    }

    return NextResponse.redirect(`${origin}/dashboard/settings?success=twitter_connected`)
  } catch (err) {
    console.error('Twitter callback exception:', err)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.redirect(
      `${origin}/dashboard/settings?error=twitter_callback_failed&details=${encodeURIComponent(msg)}`
    )
  }
}
