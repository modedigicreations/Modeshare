'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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
