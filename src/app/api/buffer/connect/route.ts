import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { generatePkce, getBufferAuthUrl } from '@/lib/buffer'

import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { verifier, challenge } = generatePkce()
  const state = crypto.randomBytes(16).toString('hex')
  const cookieStore = await cookies()

  // Store the verifier in a secure, HTTP-only cookie for verification during callback
  cookieStore.set('buffer_code_verifier', verifier, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
  })

  // Store the state in a secure, HTTP-only cookie for CSRF verification during callback
  cookieStore.set('buffer_oauth_state', state, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
  })

  const authUrl = getBufferAuthUrl(challenge, state)
  return NextResponse.redirect(authUrl)
}
