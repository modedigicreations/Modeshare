'use client'

import { Profile } from '@/types/database'
import { ROLE_LABELS } from '@/lib/utils'
import { LogOut, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  profile: Profile
}

export default function TopBar({ profile }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const initials = profile.full_name
    ? profile.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : profile.email[0].toUpperCase()

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      <div />

      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2.5 hover:bg-gray-50 rounded-lg px-2 py-1.5 transition"
        >
          <div className="w-8 h-8 rounded-full bg-ms-blue flex items-center justify-center text-white text-xs font-bold">
            {initials}
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-gray-800 leading-tight">
              {profile.full_name || profile.email}
            </p>
            <p className="text-xs text-gray-500 leading-tight">
              {ROLE_LABELS[profile.role]}
            </p>
          </div>
          <ChevronDown size={14} className="text-gray-400" />
        </button>

        {open && (
          <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50">
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-xs text-gray-500 truncate">{profile.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
