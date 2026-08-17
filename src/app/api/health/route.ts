import { NextResponse } from 'next/server'

export async function GET() {
  const checks = {
    supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabase_anon_key: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabase_service_role: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    deepseek_key: !!process.env.DEEPSEEK_API_KEY,
    buffer_client_id: !!process.env.BUFFER_CLIENT_ID,
    buffer_client_secret: !!process.env.BUFFER_CLIENT_SECRET,
    // Show partial URL so we can confirm it's correct without exposing full value
    supabase_url_preview: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? process.env.NEXT_PUBLIC_SUPABASE_URL.slice(0, 30) + '...'
      : 'NOT SET',
  }

  const allGood = checks.supabase_url && checks.supabase_anon_key && checks.supabase_service_role

  return NextResponse.json(
    { status: allGood ? 'ok' : 'misconfigured', checks },
    { status: allGood ? 200 : 500 }
  )
}
