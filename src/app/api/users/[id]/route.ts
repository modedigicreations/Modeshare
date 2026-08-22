import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const roleUpdateSchema = z.object({
  role: z.enum(['creator', 'approver', 'admin', 'super_admin']),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: targetId } = await params
    const supabase = await createClient()

    // 1. Authenticate caller
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 2. Authorize caller as super_admin
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (callerProfile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden. Super Admin access required.' }, { status: 403 })
    }

    // 3. Prevent self-demotion (cannot change own role to keep admin session safe)
    if (user.id === targetId) {
      return NextResponse.json({ error: 'Cannot demote or change your own role.' }, { status: 400 })
    }

    // 4. Validate body
    const body = await request.json()
    const parsed = roleUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid role value' }, { status: 400 })
    }

    // 5. Update user role
    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({ role: parsed.data.role })
      .eq('id', targetId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, user: updated })
  } catch (err) {
    console.error('Role update error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
