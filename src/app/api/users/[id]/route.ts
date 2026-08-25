import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const userUpdateSchema = z.object({
  role: z.enum(['creator', 'approver', 'admin', 'super_admin']).optional(),
  email: z.string().email().optional(),
  fullName: z.string().optional(),
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

    // 3. Validate body
    const body = await request.json()
    const parsed = userUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid user update values' }, { status: 400 })
    }

    // 4. Prevent self-demotion (cannot change own role to keep admin session safe)
    if (user.id === targetId && parsed.data.role) {
      return NextResponse.json({ error: 'Cannot demote or change your own role.' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // 5. Update auth.users if email or full name changes
    if (parsed.data.email || parsed.data.fullName !== undefined) {
      const authUpdates: Record<string, any> = {}
      if (parsed.data.email) {
        authUpdates.email = parsed.data.email
        authUpdates.email_confirm = true
      }
      if (parsed.data.fullName !== undefined) {
        authUpdates.user_metadata = { full_name: parsed.data.fullName }
      }

      const { error: authError } = await adminClient.auth.admin.updateUserById(targetId, authUpdates)
      if (authError) {
        return NextResponse.json({ error: `Auth update failed: ${authError.message}` }, { status: 500 })
      }
    }

    // 6. Update public.profiles
    const profileUpdates: Record<string, any> = {}
    if (parsed.data.role) profileUpdates.role = parsed.data.role
    if (parsed.data.email) profileUpdates.email = parsed.data.email
    if (parsed.data.fullName !== undefined) profileUpdates.full_name = parsed.data.fullName

    const { data: updated, error: updateError } = await adminClient
      .from('profiles')
      .update(profileUpdates)
      .eq('id', targetId)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: `Profile update failed: ${updateError.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, user: updated })
  } catch (err) {
    console.error('User update error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
