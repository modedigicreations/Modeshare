'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react'
import { loginAction, signupAction, forgotPasswordAction } from '@/app/auth/actions'

export default function LoginForm() {
  const searchParams = useSearchParams()
  const rawUrlError = searchParams.get('error')
  const isGenericSessionError = rawUrlError?.includes('session missing') || rawUrlError?.includes('No user session')
  const urlError = isGenericSessionError ? null : rawUrlError
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forgotSent, setForgotSent] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const form = new FormData(e.currentTarget)

    try {
      if (mode === 'forgot') {
        const origin = typeof window !== 'undefined' ? window.location.origin : undefined
        const res = await forgotPasswordAction(form, origin)
        if (!res.success) {
          setError(res.error || 'Failed to send reset email')
          return
        }
        setForgotSent(true)
        return
      }

      if (mode === 'signup') {
        const res = await signupAction(form)
        if (!res.success) {
          setError(res.error || 'Signup failed')
          return
        }
        if (res.requiresConfirmation) {
          setError('Almost there! Check your email to confirm your account, then sign in.')
          return
        }
      } else {
        const res = await loginAction(form)
        if (!res.success) {
          setError(res.error || 'Login failed')
          return
        }
      }

      // Session cookies are set in the response headers.
      // Use absolute URL redirect to avoid Next.js relative url linter warning
      // and do a hard reload to ensure the middleware/server gets the new cookies.
      window.location.replace(new URL('/dashboard', window.location.origin).toString())

    } catch (err) {
      setError('Something went wrong. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {mode === 'login'
            ? 'Welcome back'
            : mode === 'signup'
              ? 'Create account'
              : 'Reset password'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {mode === 'login'
            ? 'Sign in to your Modeshare account'
            : mode === 'signup'
              ? 'Join your team on Modeshare'
              : 'Enter your email to receive a password reset link'}
        </p>
      </div>

      {(error || urlError) && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error || urlError}
        </div>
      )}

      {forgotSent && mode === 'forgot' ? (
        <div className="space-y-4 py-2">
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg p-4 flex items-start gap-3">
            <CheckCircle2 size={20} className="shrink-0 text-green-600 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Reset link sent!</p>
              <p className="text-xs text-green-600 leading-relaxed">
                Check your email inbox for the reset link. Click it to create your new password.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setMode('login')
              setForgotSent(false)
              setError(null)
            }}
            className="w-full text-center text-sm text-ms-blue hover:text-ms-blue-dark font-medium py-2"
          >
            &larr; Back to Sign in
          </button>
        </div>
      ) : (
        <>
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

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot')
                      setError(null)
                      setForgotSent(false)
                    }}
                    className="text-xs text-ms-blue hover:text-ms-blue-dark font-medium"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
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
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ms-red hover:bg-ms-red-dark text-white font-semibold py-2.5 rounded-lg text-sm transition disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {mode === 'login'
              ? 'Sign in'
              : mode === 'signup'
                ? 'Create account'
                : 'Send reset link'}
          </button>

          <div className="text-center text-sm text-gray-500">
            {mode === 'login' ? (
              <>
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('signup'); setError(null) }}
                  className="text-ms-blue hover:text-ms-blue-dark font-medium cursor-pointer"
                >
                  Sign up
                </button>
              </>
            ) : mode === 'signup' ? (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null) }}
                  className="text-ms-blue hover:text-ms-blue-dark font-medium cursor-pointer"
                >
                  Sign in
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null) }}
                className="text-ms-blue hover:text-ms-blue-dark font-medium inline-flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft size={13} /> Back to Sign in
              </button>
            )}
          </div>
        </>
      )}
    </form>
  )
}
