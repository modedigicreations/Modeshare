import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getLinkedInPages } from '@/lib/linkedin'
import { z } from 'zod'

const switchAccountSchema = z.object({
  accountId: z.string().min(1),
})

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : supabase
    const { data: conn } = await db
      .from('linkedin_connections')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!conn) {
      return NextResponse.json({ error: 'No LinkedIn connection found' }, { status: 404 })
    }

    const fetchedAccounts = await getLinkedInPages(conn.access_token)
    const accounts = [...fetchedAccounts]

    if (conn.account_id && !accounts.some((a) => a.id === conn.account_id)) {
      accounts.push({
        id: conn.account_id,
        name: conn.account_name || (conn.account_type === 'organization' ? 'LinkedIn Organization' : 'LinkedIn Member'),
        type: conn.account_type || (conn.account_id.includes('organization') ? 'organization' : 'person'),
      })
    }

    return NextResponse.json({
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        isActive: a.id === conn.account_id,
      })),
      activeAccountId: conn.account_id,
    })
  } catch (err) {
    console.error('Fetch LinkedIn accounts error:', err)
    const msg = err instanceof Error ? err.message : 'Failed to fetch LinkedIn accounts'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const parsed = switchAccountSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const { accountId } = parsed.data

    const db = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : supabase
    const { data: conn } = await db
      .from('linkedin_connections')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!conn) {
      return NextResponse.json({ error: 'No LinkedIn connection found' }, { status: 404 })
    }

    const accounts = await getLinkedInPages(conn.access_token)
    const targetAccount = accounts.find((a) => a.id === accountId) || {
      id: accountId,
      name: accountId.includes('organization') ? 'LinkedIn Organization' : 'LinkedIn Profile',
      type: accountId.includes('organization') ? ('organization' as const) : ('person' as const),
    }

    const { error: updateError } = await db
      .from('linkedin_connections')
      .update({
        account_id: targetAccount.id,
        account_name: targetAccount.name,
        account_type: targetAccount.type,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (updateError) {
      throw new Error(updateError.message)
    }

    return NextResponse.json({
      success: true,
      activeAccount: targetAccount,
    })
  } catch (err) {
    console.error('Switch LinkedIn account error:', err)
    const msg = err instanceof Error ? err.message : 'Failed to switch LinkedIn account'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
