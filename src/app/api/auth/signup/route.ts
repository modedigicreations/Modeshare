import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { email, password, full_name } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: full_name?.trim() || '' },
      },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (data?.user && !data.session) {
      return NextResponse.json({
        error: 'Check your email to confirm your account, then sign in.',
      }, { status: 200 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Signup error:', err)
    const message = err instanceof Error ? err.message : 'Signup failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
