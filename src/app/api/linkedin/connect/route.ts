import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getLinkedInAuthUrl } from '@/lib/linkedin'
import { cookies } from 'next/headers'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.redirect(new URL('/login?error=unauthorized', request.url))
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

    const requestOrigin = request.nextUrl.origin
    const authUrl = getLinkedInAuthUrl(state, requestOrigin)

    return NextResponse.redirect(authUrl)
  } catch (err) {
    console.error('LinkedIn connect error:', err)
    return NextResponse.redirect(new URL('/dashboard/settings?error=linkedin_connect_failed', request.url))
  }
}
