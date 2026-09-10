import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { exchangeFacebookCode, getFacebookPages } from '@/lib/facebook'

function getRequestOrigin(request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  if (host) {
    return `${proto}://${host}`
  }
  return new URL(request.url).origin
}

export async function GET(request: NextRequest) {
  const origin = getRequestOrigin(request)
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')
  const stateParam = searchParams.get('state')

  if (error || !code) {
    return NextResponse.redirect(
      `${origin}/dashboard/settings?error=facebook_auth_failed&details=${encodeURIComponent(
        errorDescription || error || 'No authorization code returned by Facebook'
      )}`
    )
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.redirect(`${origin}/login`)

    // Verify state cookie
    const cookieStore = await cookies()
    const savedState = cookieStore.get('facebook_oauth_state')?.value
    cookieStore.delete('facebook_oauth_state')

    if (!savedState || savedState !== stateParam) {
      console.error('Facebook OAuth state mismatch')
      return NextResponse.redirect(
        `${origin}/dashboard/settings?error=facebook_auth_failed&details=OAuth%20state%20mismatch%20(session%20expired%20or%20invalid)`
      )
    }

    // 1. Exchange code for long-lived user access token
    const userAccessToken = await exchangeFacebookCode(code, origin)


    // 2. Fetch user's managed Facebook Pages
    const pages = await getFacebookPages(userAccessToken)
    if (pages.length === 0) {
      return NextResponse.redirect(
        `${origin}/dashboard/settings?error=facebook_no_pages&details=No%20Facebook%20Pages%20found%20for%20this%20account.%20Please%20ensure%20you%20admin%20or%20manage%20at%20least%20one%20Facebook%20Page.`
      )
    }

    // Primary default page is the first page
    const selectedPage = pages[0]

    // 3. Upsert facebook_connections
    const { error: upsertError } = await supabase.from('facebook_connections').upsert(
      {
        user_id: user.id,
        access_token: userAccessToken,
        page_id: selectedPage.id,
        page_name: selectedPage.name,
        page_access_token: selectedPage.access_token,
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    if (upsertError) {
      throw new Error(`Database upsert failed: ${upsertError.message}`)
    }

    return NextResponse.redirect(`${origin}/dashboard/settings?success=facebook_connected`)
  } catch (err) {
    console.error('Facebook callback error:', err)
    const msg = err instanceof Error ? err.message : 'Unknown callback error'
    return NextResponse.redirect(
      `${origin}/dashboard/settings?error=facebook_callback_failed&details=${encodeURIComponent(msg)}`
    )
  }
}
