import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exchangeLinkedInCode, resolveLinkedInConnection } from '@/lib/linkedin'
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
      console.error('LinkedIn OAuth error param:', errorDesc)
      return NextResponse.redirect(
        `${origin}/dashboard/settings?error=linkedin_auth_failed&details=${encodeURIComponent(errorDesc)}`
      )
    }

    if (!code) {
      return NextResponse.redirect(`${origin}/dashboard/settings?error=linkedin_no_code`)
    }

    const cookieStore = await cookies()
    const storedState = cookieStore.get('linkedin_oauth_state')?.value

    if (!storedState || !state || storedState !== state) {
      return NextResponse.redirect(`${origin}/dashboard/settings?error=linkedin_state_mismatch`)
    }

    cookieStore.delete('linkedin_oauth_state')

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.redirect(`${origin}/login?error=session_expired`)
    }

    const tokenResult = await exchangeLinkedInCode(code, origin)
    const resolved = await resolveLinkedInConnection(tokenResult.accessToken)

    let expiresAt: string | null = null
    if (tokenResult.expiresIn) {
      expiresAt = new Date(Date.now() + tokenResult.expiresIn * 1000).toISOString()
    }

    const db = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : supabase
    const { error: upsertErr } = await db.from('linkedin_connections').upsert(
      {
        user_id: user.id,
        access_token: tokenResult.accessToken,
        refresh_token: tokenResult.refreshToken || null,
        expires_at: expiresAt,
        account_id: resolved.selectedAccount.id,
        account_name: resolved.selectedAccount.name,
        account_type: resolved.selectedAccount.type,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    if (upsertErr) {
      console.error('Supabase linkedin_connections upsert error:', upsertErr)
      return NextResponse.redirect(
        `${origin}/dashboard/settings?error=linkedin_db_failed&details=${encodeURIComponent(upsertErr.message)}`
      )
    }

    return NextResponse.redirect(`${origin}/dashboard/settings?success=linkedin_connected`)
  } catch (err) {
    console.error('LinkedIn callback exception:', err)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.redirect(
      `${origin}/dashboard/settings?error=linkedin_callback_failed&details=${encodeURIComponent(msg)}`
    )
  }
}
