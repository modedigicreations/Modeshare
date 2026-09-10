import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFacebookPages } from '@/lib/facebook'
import { z } from 'zod'

const switchPageSchema = z.object({
  pageId: z.string().min(1),
})

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: conn } = await supabase
      .from('facebook_connections')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!conn) {
      return NextResponse.json({ error: 'No Facebook connection found' }, { status: 404 })
    }

    const pages = await getFacebookPages(conn.access_token)
    return NextResponse.json({
      pages: pages.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        isActive: p.id === conn.page_id,
      })),
      activePageId: conn.page_id,
    })
  } catch (err) {
    console.error('Fetch Facebook pages error:', err)
    const msg = err instanceof Error ? err.message : 'Failed to fetch Facebook pages'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const parsed = switchPageSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const { pageId } = parsed.data

    const { data: conn } = await supabase
      .from('facebook_connections')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!conn) {
      return NextResponse.json({ error: 'No Facebook connection found' }, { status: 404 })
    }

    const pages = await getFacebookPages(conn.access_token)
    const targetPage = pages.find((p) => p.id === pageId)

    if (!targetPage) {
      return NextResponse.json({ error: 'Page not found in your Facebook account' }, { status: 404 })
    }

    const { error: updateError } = await supabase
      .from('facebook_connections')
      .update({
        page_id: targetPage.id,
        page_name: targetPage.name,
        page_access_token: targetPage.access_token,
      })
      .eq('user_id', user.id)

    if (updateError) {
      throw new Error(updateError.message)
    }

    return NextResponse.json({
      success: true,
      activePage: {
        id: targetPage.id,
        name: targetPage.name,
      },
    })
  } catch (err) {
    console.error('Switch Facebook page error:', err)
    const msg = err instanceof Error ? err.message : 'Failed to switch Facebook page'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
