import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getFacebookAuthUrl } from '@/lib/facebook'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

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
  const state = crypto.randomBytes(16).toString('hex')
  const cookieStore = await cookies()
  const configId = request.nextUrl.searchParams.get('config_id') || undefined

  // Store the state in a secure, HTTP-only cookie for CSRF verification during callback
  cookieStore.set('facebook_oauth_state', state, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
  })

  const authUrl = getFacebookAuthUrl(state, origin, configId)
  return NextResponse.redirect(authUrl)
}
