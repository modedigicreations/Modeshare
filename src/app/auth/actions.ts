'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isRedirectError } from 'next/dist/client/components/redirect-error'

export async function login(formData: FormData) {
  try {
    const supabase = await createClient()

    const email = (formData.get('email') as string)?.trim()
    const password = formData.get('password') as string

    if (!email || !password) {
      redirect('/login?error=' + encodeURIComponent('Email and password are required.'))
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      redirect('/login?error=' + encodeURIComponent(error.message))
    }

    revalidatePath('/', 'layout')
    redirect('/dashboard')
  } catch (err) {
    if (isRedirectError(err)) throw err
    console.error('Login error:', err)
    const msg = err instanceof Error ? err.message : 'Login failed. Please try again.'
    redirect('/login?error=' + encodeURIComponent(msg))
  }
}

export async function signup(formData: FormData) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')) {
      redirect('/login?error=' + encodeURIComponent('Supabase is not configured. Please set environment variables in Vercel.'))
    }

    const supabase = await createClient()

    const email = (formData.get('email') as string)?.trim()
    const password = formData.get('password') as string
    const full_name = (formData.get('full_name') as string)?.trim()

    if (!email || !password) {
      redirect('/login?error=' + encodeURIComponent('Email and password are required.'))
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: full_name || '' },
      },
    })

    if (error) {
      redirect('/login?error=' + encodeURIComponent(error.message))
    }

    // Email confirmation required (common Supabase default)
    if (data?.user && !data.session) {
      redirect('/login?error=' + encodeURIComponent('Almost there! Check your email to confirm your account, then sign in.'))
    }

    revalidatePath('/', 'layout')
    redirect('/dashboard')
  } catch (err) {
    if (isRedirectError(err)) throw err
    console.error('Signup error:', err)
    const msg = err instanceof Error ? err.message : 'Signup failed. Please try again.'
    redirect('/login?error=' + encodeURIComponent(msg))
  }
}

export async function logout() {
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
  } catch {
    // ignore
  }
  revalidatePath('/', 'layout')
  redirect('/login')
}
