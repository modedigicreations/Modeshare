import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getLinkedInAuthUrl } from '@/lib/linkedin'
import { getAppOrigin } from '@/lib/utils'
import { cookies } from 'next/headers'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  const origin = getAppOrigin(request)
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.redirect(`${origin}/login?error=unauthorized`)
    }

    const state = crypto.randomBytes(16).toString('hex')
    const cookieStore = await cookies()
    cookieStore.set('linkedin_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    })

    const authUrl = getLinkedInAuthUrl(state, origin)

    return NextResponse.redirect(authUrl)
  } catch (err) {
    console.error('LinkedIn connect error:', err)
    return NextResponse.redirect(`${origin}/dashboard/settings?error=linkedin_connect_failed`)
  }
}
