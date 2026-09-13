import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeLinkedInCode, resolveLinkedInConnection } from '@/lib/linkedin'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      const errorDesc = searchParams.get('error_description') || error
      console.error('LinkedIn OAuth error param:', errorDesc)
      return NextResponse.redirect(
        new URL(`/dashboard/settings?error=linkedin_auth_failed&details=${encodeURIComponent(errorDesc)}`, request.url)
      )
    }

    if (!code) {
      return NextResponse.redirect(new URL('/dashboard/settings?error=linkedin_no_code', request.url))
    }

    const cookieStore = await cookies()
    const storedState = cookieStore.get('linkedin_oauth_state')?.value

    if (!storedState || !state || storedState !== state) {
      return NextResponse.redirect(new URL('/dashboard/settings?error=linkedin_state_mismatch', request.url))
    }

    cookieStore.delete('linkedin_oauth_state')

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.redirect(new URL('/login?error=session_expired', request.url))
    }

    const tokenResult = await exchangeLinkedInCode(code, request.nextUrl.origin)
    const resolved = await resolveLinkedInConnection(tokenResult.accessToken)

    let expiresAt: string | null = null
    if (tokenResult.expiresIn) {
      expiresAt = new Date(Date.now() + tokenResult.expiresIn * 1000).toISOString()
    }

    const { error: upsertErr } = await supabase.from('linkedin_connections').upsert(
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
        new URL(`/dashboard/settings?error=linkedin_db_failed&details=${encodeURIComponent(upsertErr.message)}`, request.url)
      )
    }

    return NextResponse.redirect(new URL('/dashboard/settings?success=linkedin_connected', request.url))
  } catch (err) {
    console.error('LinkedIn callback exception:', err)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.redirect(
      new URL(`/dashboard/settings?error=linkedin_callback_failed&details=${encodeURIComponent(msg)}`, request.url)
    )
  }
}
