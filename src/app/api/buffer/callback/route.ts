import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { exchangeBufferCode, getBufferProfiles, findProfileId } from '@/lib/buffer'
import { Platform } from '@/types/database'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${origin}/dashboard/settings?error=buffer_auth_failed`)
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.redirect(`${origin}/login`)

    // Retrieve code verifier from cookies
    const cookieStore = await cookies()
    const codeVerifier = cookieStore.get('buffer_code_verifier')?.value

    if (!codeVerifier) {
      console.error('Missing buffer_code_verifier cookie')
      return NextResponse.redirect(`${origin}/dashboard/settings?error=buffer_auth_failed`)
    }

    // Exchange code for access token
    const accessToken = await exchangeBufferCode(code, codeVerifier)

    // Clear the verifier cookie
    cookieStore.delete('buffer_code_verifier')

    // Fetch connected profiles and map to our platforms
    const profiles = await getBufferProfiles(accessToken)
    const platforms: Platform[] = ['facebook', 'twitter', 'linkedin']
    const profileIds: Record<string, string> = {}

    for (const platform of platforms) {
      const id = findProfileId(profiles, platform)
      if (id) profileIds[platform] = id
    }

    // Upsert the buffer connection
    await supabase.from('buffer_connections').upsert(
      {
        user_id: user.id,
        access_token: accessToken,
        profile_ids: profileIds,
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    return NextResponse.redirect(`${origin}/dashboard/settings?success=buffer_connected`)
  } catch (err) {
    console.error('Buffer callback error:', err)
    return NextResponse.redirect(`${origin}/dashboard/settings?error=buffer_callback_failed`)
  }
}
