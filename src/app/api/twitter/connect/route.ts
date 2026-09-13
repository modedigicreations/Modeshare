import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTwitterAuthUrl } from '@/lib/twitter'
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
    const codeVerifier = crypto.randomBytes(32).toString('base64url')
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url')

    const cookieStore = await cookies()
    cookieStore.set('twitter_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    })
    cookieStore.set('twitter_code_verifier', codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    })

    const requestOrigin = request.nextUrl.origin
    const authUrl = getTwitterAuthUrl(state, codeChallenge, requestOrigin)

    return NextResponse.redirect(authUrl)
  } catch (err) {
    console.error('Twitter connect error:', err)
    return NextResponse.redirect(new URL('/dashboard/settings?error=twitter_connect_failed', request.url))
  }
}
