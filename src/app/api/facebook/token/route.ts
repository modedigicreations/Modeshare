import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { upgradeToLongLivedToken, getFacebookPages } from '@/lib/facebook'
import { z } from 'zod'

const tokenSchema = z.object({
  accessToken: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const parsed = tokenSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Missing access token' }, { status: 400 })
    }

    const { accessToken } = parsed.data

    // 1. Upgrade token to long-lived 60-day token
    const longLivedToken = await upgradeToLongLivedToken(accessToken)

    // 2. Fetch Facebook Pages
    const pages = await getFacebookPages(longLivedToken)
    if (pages.length === 0) {
      return NextResponse.json(
        { error: 'No Facebook Pages found. Make sure your account administers at least one Facebook Page.' },
        { status: 400 }
      )
    }

    const selectedPage = pages[0]

    // 3. Upsert facebook_connections
    const { error: upsertError } = await supabase.from('facebook_connections').upsert(
      {
        user_id: user.id,
        access_token: longLivedToken,
        page_id: selectedPage.id,
        page_name: selectedPage.name,
        page_access_token: selectedPage.access_token,
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    if (upsertError) {
      throw new Error(`Database upsert failed: ${upsertError.message}`)
    }

    return NextResponse.json({
      success: true,
      page: {
        id: selectedPage.id,
        name: selectedPage.name,
      },
      pagesCount: pages.length,
    })
  } catch (err) {
    console.error('Facebook token exchange error:', err)
    const msg = err instanceof Error ? err.message : 'Failed to connect Facebook account'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
