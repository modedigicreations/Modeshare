import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Never intercept these paths
  const bypass = ['/api/', '/_next/', '/favicon', '/login', '/auth/']
  if (bypass.some((p) => pathname.startsWith(p))) {
    return NextResponse.next({ request })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // If env vars missing, let the page handle it
  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('your-project')) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  try {
    const allCookies = request.cookies.getAll()
    const cookieNames = allCookies.map(c => c.name).join(', ')

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return allCookies
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    })

    // Refresh and verify session
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      // Not authenticated — redirect to login
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      if (error) {
        url.searchParams.set('error', `Session error: ${error.message}. Cookies: [${cookieNames}]`)
      } else {
        url.searchParams.set('error', `No active user session. Cookies: [${cookieNames}]`)
      }
      return NextResponse.redirect(url)
    }

    return supabaseResponse

  } catch (err) {
    // On any error, redirect to login with error details rather than crashing silently
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('error', `Middleware crash: ${err instanceof Error ? err.message : String(err)}`)
    return NextResponse.redirect(url)
  }
}
