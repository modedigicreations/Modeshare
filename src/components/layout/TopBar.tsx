'use client'

import { Profile } from '@/types/database'
import { ROLE_LABELS } from '@/lib/utils'
import { LogOut, ChevronDown, Menu } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { logoutAction } from '@/app/auth/actions'

interface Props {
  profile: Profile
  onMenuClick?: () => void
}

export default function TopBar({ profile, onMenuClick }: Props) {
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
    await logoutAction()
    window.location.replace(new URL('/login', window.location.origin).toString())
  }

  console.log("TopBar rendered with profile:", profile)

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : profile?.email
      ? profile.email[0].toUpperCase()
      : 'U'

  return (
    <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-6 shrink-0 sticky top-0 z-30">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition mr-2"
      >
        <Menu size={20} />
      </button>

      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2.5 hover:bg-slate-50/80 border border-transparent hover:border-slate-200/60 rounded-xl px-3 py-1.5 transition-all duration-200"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-ms-blue to-blue-500 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-ms-blue/20">
            {initials}
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-sm font-semibold text-slate-700 leading-tight">
              {profile.full_name || profile.email}
            </p>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider leading-tight">
              {ROLE_LABELS[profile.role]}
            </p>
          </div>
          <ChevronDown size={14} className="text-slate-400" />
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-52 bg-white/95 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-xl py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="px-4 py-2.5 border-b border-slate-100">
              <p className="text-xs text-slate-400 font-medium truncate">Logged in as</p>
              <p className="text-sm text-slate-700 font-semibold truncate mt-0.5">{profile.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50/50 transition font-medium"
            >
              <LogOut size={15} />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
