'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  try {
    const supabase = await createClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      redirect('/login?error=' + encodeURIComponent(error.message))
    }

    revalidatePath('/', 'layout')
    redirect('/dashboard')
  } catch (err) {
    // Re-throw redirect — Next.js uses thrown redirects internally
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    const msg = err instanceof Error ? err.message : 'Login failed. Check your credentials.'
    redirect('/login?error=' + encodeURIComponent(msg))
  }
}

export async function signup(formData: FormData) {
  try {
    // Validate env vars are present
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      redirect('/login?error=' + encodeURIComponent('App is not configured yet. Please set Supabase environment variables.'))
    }

    const supabase = await createClient()

    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const full_name = formData.get('full_name') as string

    if (!email || !password) {
      redirect('/login?error=' + encodeURIComponent('Email and password are required.'))
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name },
      },
    })

    if (error) {
      redirect('/login?error=' + encodeURIComponent(error.message))
    }

    // Supabase may require email confirmation — handle that gracefully
    if (data?.user && !data.session) {
      redirect('/login?error=' + encodeURIComponent('Check your email to confirm your account, then sign in.'))
    }

    revalidatePath('/', 'layout')
    redirect('/dashboard')
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    const msg = err instanceof Error ? err.message : 'Signup failed. Please try again.'
    redirect('/login?error=' + encodeURIComponent(msg))
  }
}

export async function logout() {
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
  } catch {
    // ignore signout errors
  }
  revalidatePath('/', 'layout')
  redirect('/login')
}
