'use client'

import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

interface Props {
  loginAction: (formData: FormData) => Promise<void>
  signupAction: (formData: FormData) => Promise<void>
}

export default function LoginForm({ loginAction, signupAction }: Props) {
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')

  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    const formData = new FormData(e.currentTarget)
    if (mode === 'login') {
      await loginAction(formData)
    } else {
      await signupAction(formData)
    }
    setPending(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {mode === 'login'
            ? 'Sign in to your Modeshare account'
            : 'Join your team on Modeshare'}
        </p>
      </div>

      {errorParam && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {decodeURIComponent(errorParam)}
        </div>
      )}

      {mode === 'signup' && (
        <div>
          <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">
            Full name
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            required
            autoComplete="name"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ms-blue focus:border-transparent transition"
            placeholder="Jane Smith"
          />
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ms-blue focus:border-transparent transition"
          placeholder="you@company.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            minLength={8}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ms-blue focus:border-transparent transition"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-ms-red hover:bg-ms-red-dark text-white font-semibold py-2.5 rounded-lg text-sm transition disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {pending && <Loader2 size={16} className="animate-spin" />}
        {mode === 'login' ? 'Sign in' : 'Create account'}
      </button>

      <div className="text-center text-sm text-gray-500">
        {mode === 'login' ? (
          <>
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={() => setMode('signup')}
              className="text-ms-blue hover:text-ms-blue-dark font-medium"
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => setMode('login')}
              className="text-ms-blue hover:text-ms-blue-dark font-medium"
            >
              Sign in
            </button>
          </>
        )}
      </div>
    </form>
  )
}
