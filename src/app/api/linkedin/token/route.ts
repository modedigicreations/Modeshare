import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveLinkedInConnection } from '@/lib/linkedin'
import { z } from 'zod'

const tokenSchema = z.object({
  accessToken: z.string().min(1),
  accountId: z.string().optional(),
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

    const { accessToken, accountId } = parsed.data

    // Validate token and resolve LinkedIn account (Organization or Person)
    const resolved = await resolveLinkedInConnection(accessToken, accountId)
    const targetAccount = resolved.selectedAccount

    const db = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : supabase
    const { error: upsertError } = await db.from('linkedin_connections').upsert(
      {
        user_id: user.id,
        access_token: accessToken.trim(),
        account_id: targetAccount.id,
        account_name: targetAccount.name,
        account_type: targetAccount.type,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    if (upsertError) {
      throw new Error(`Database upsert failed: ${upsertError.message}`)
    }

    return NextResponse.json({
      success: true,
      account: targetAccount,
      accountsCount: resolved.accounts.length,
    })
  } catch (err) {
    console.error('LinkedIn manual token connect error:', err)
    const msg = err instanceof Error ? err.message : 'Failed to connect LinkedIn account'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
