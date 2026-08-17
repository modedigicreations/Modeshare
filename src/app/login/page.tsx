import { login, signup } from '@/app/auth/actions'
import { Suspense } from 'react'
import LoginForm from './LoginForm'

export const metadata = {
  title: 'Sign In — Modeshare',
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-ms-blue via-ms-blue-dark to-slate-900 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-ms-red flex items-center justify-center">
              <span className="text-white font-bold text-lg">M</span>
            </div>
            <span className="text-white text-2xl font-bold tracking-tight">Modeshare</span>
          </div>
          <p className="text-blue-200 text-sm">Internal Marketing Platform</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <Suspense>
            <LoginForm loginAction={login} signupAction={signup} />
          </Suspense>
        </div>

        <p className="text-center text-blue-200 text-xs mt-6">
          © {new Date().getFullYear()} Modeshare · Internal use only
        </p>
      </div>
    </main>
  )
}
