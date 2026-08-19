import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { exchangeBufferCode, getBufferProfiles, findProfileId } from '@/lib/buffer'
import { Platform } from '@/types/database'

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
  const stateParam = searchParams.get('state')

  if (error || !code) {
    return NextResponse.redirect(
      `${origin}/dashboard/settings?error=buffer_auth_failed&details=${encodeURIComponent(error || 'No authorization code returned')}`
    )
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.redirect(`${origin}/login`)

    // Retrieve verifier and state from cookies
    const cookieStore = await cookies()
    const codeVerifier = cookieStore.get('buffer_code_verifier')?.value
    const savedState = cookieStore.get('buffer_oauth_state')?.value

    // Clean up authentication cookies
    cookieStore.delete('buffer_code_verifier')
    cookieStore.delete('buffer_oauth_state')

    if (!codeVerifier) {
      console.error('Missing buffer_code_verifier cookie')
      return NextResponse.redirect(
        `${origin}/dashboard/settings?error=buffer_auth_failed&details=Missing%20code%20verifier%20session%20cookie`
      )
    }

    if (!savedState || savedState !== stateParam) {
      console.error('Buffer OAuth state mismatch')
      return NextResponse.redirect(
        `${origin}/dashboard/settings?error=buffer_auth_failed&details=OAuth%20state%20mismatch%20(possible%20CSRF%20or%20session%20expiration)`
      )
    }

    // Exchange code for access token
    const accessToken = await exchangeBufferCode(code, codeVerifier)

    // Fetch connected profiles and map to our platforms
    const profiles = await getBufferProfiles(accessToken)
    const platforms: Platform[] = ['facebook', 'twitter', 'linkedin']
    const profileIds: Record<string, string> = {}

    for (const platform of platforms) {
      const id = findProfileId(profiles, platform)
      if (id) profileIds[platform] = id
    }

    // Upsert the buffer connection
    const { error: upsertError } = await supabase.from('buffer_connections').upsert(
      {
        user_id: user.id,
        access_token: accessToken,
        profile_ids: profileIds,
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    if (upsertError) {
      throw new Error(`Database upsert failed: ${upsertError.message}`)
    }

    return NextResponse.redirect(`${origin}/dashboard/settings?success=buffer_connected`)
  } catch (err) {
    console.error('Buffer callback error:', err)
    const msg = err instanceof Error ? err.message : 'Unknown callback error'
    return NextResponse.redirect(
      `${origin}/dashboard/settings?error=buffer_callback_failed&details=${encodeURIComponent(msg)}`
    )
  }
}
