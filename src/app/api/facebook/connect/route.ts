import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getFacebookAuthUrl } from '@/lib/facebook'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function GET() {
  const state = crypto.randomBytes(16).toString('hex')
  const cookieStore = await cookies()

  // Store the state in a secure, HTTP-only cookie for CSRF verification during callback
  cookieStore.set('facebook_oauth_state', state, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
  })

  const authUrl = getFacebookAuthUrl(state)
  return NextResponse.redirect(authUrl)
}
