'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { notifySuperAdmins } from '@/lib/email'

export async function loginAction(formData: FormData) {
  try {
    const supabase = await createClient()

    const email = (formData.get('email') as string)?.trim()
    const password = formData.get('password') as string

    if (!email || !password) {
      return { success: false, error: 'Email and password are required.' }
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/', 'layout')
    return { success: true }
  } catch (err) {
    console.error('Login error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Login failed. Please try again.' }
  }
}

export async function signupAction(formData: FormData) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')) {
      return { success: false, error: 'Supabase is not configured. Please set environment variables.' }
    }

    const supabase = await createClient()

    const email = (formData.get('email') as string)?.trim()
    const password = formData.get('password') as string
    const full_name = (formData.get('full_name') as string)?.trim()

    if (!email || !password) {
      return { success: false, error: 'Email and password are required.' }
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: full_name || '' },
      },
    })

    if (error) {
      return { success: false, error: error.message }
    }

    // Trigger notification and wait for it to complete
    if (data?.user) {
      await notifySuperAdmins({
        subject: '🔔 Modeshare: New User Registered',
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <h2 style="color: #0f172a; margin-top: 0; font-size: 18px; border-b: 1px solid #e2e8f0; padding-bottom: 12px;">New User Sign-up</h2>
            <p style="color: #475569; font-size: 14px; line-height: 1.5;">A new account has been created on Modeshare:</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 14px;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; width: 120px; border-bottom: 1px solid #f1f5f9;"><strong>Name:</strong></td>
                <td style="padding: 8px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${full_name || '—'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; border-bottom: 1px solid #f1f5f9;"><strong>Email:</strong></td>
                <td style="padding: 8px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${email}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; border-bottom: 1px solid #f1f5f9;"><strong>Registered At:</strong></td>
                <td style="padding: 8px 0; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${new Date().toLocaleString()}</td>
              </tr>
            </table>
            <p style="margin-top: 20px; font-size: 12px; color: #94a3b8; text-align: center;">This is an automated notification from Modeshare.</p>
          </div>
        `,
      }).catch((e) => console.error('Failed to notify super admin of signup:', e))
    }

    // Email confirmation required (common Supabase default)
    if (data?.user && !data.session) {
      return { success: true, requiresConfirmation: true }
    }

    revalidatePath('/', 'layout')
    return { success: true }
  } catch (err) {
    console.error('Signup error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Signup failed. Please try again.' }
  }
}

export async function logoutAction() {
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (err) {
    console.error('Logout error:', err)
    return { success: true }
  }
}

import { UserRole } from '@/types/database'

export async function updateRoleAction(role: UserRole) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', user.id)

    if (error) return { success: false, error: error.message }

    revalidatePath('/', 'layout')
    return { success: true }
  } catch (err) {
    console.error('Update role error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update role' }
  }
}
