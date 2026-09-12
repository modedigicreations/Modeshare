import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveFacebookConnection } from '@/lib/facebook'
import { z } from 'zod'

const tokenSchema = z.object({
  accessToken: z.string().min(1),
  appSecret: z.string().optional(),
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

    const { accessToken, appSecret } = parsed.data

    // 1. Resolve and upgrade token to permanent page token
    const result = await resolveFacebookConnection(accessToken, appSecret)

    if (result.pages.length === 0) {
      return NextResponse.json(
        { error: 'No Facebook Pages found. Make sure your account administers at least one Facebook Page.' },
        { status: 400 }
      )
    }

    const selectedPage = result.pages[0]

    // 2. Upsert facebook_connections with the permanent page access token
    const { error: upsertError } = await supabase.from('facebook_connections').upsert(
      {
        user_id: user.id,
        access_token: result.userToken,
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
      pagesCount: result.pages.length,
      tokenType: result.tokenType,
      isDirectPageToken: result.isDirectPageToken,
    })
  } catch (err) {
    console.error('Facebook token exchange error:', err)
    const msg = err instanceof Error ? err.message : 'Failed to connect Facebook account'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
