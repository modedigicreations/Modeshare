import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { generatePkce, getBufferAuthUrl } from '@/lib/buffer'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { verifier, challenge } = generatePkce()
  const cookieStore = await cookies()

  // Store the verifier in a secure, HTTP-only cookie for verification during callback
  cookieStore.set('buffer_code_verifier', verifier, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
  })

  const authUrl = getBufferAuthUrl(challenge)
  return NextResponse.redirect(authUrl)
}
