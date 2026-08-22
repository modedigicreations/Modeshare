'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  PenSquare,
  ClipboardCheck,
  CalendarDays,
  History,
  Settings,
  Share2,
  BarChart3,
  X,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserRole } from '@/types/database'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  roles?: UserRole[]
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/briefs/new', label: 'New Brief', icon: PenSquare },
  { href: '/dashboard/briefs', label: 'My Briefs', icon: History },
  {
    href: '/dashboard/approvals',
    label: 'Approvals',
    icon: ClipboardCheck,
    roles: ['approver', 'admin'],
  },
  { href: '/dashboard/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  {
    href: '/dashboard/users',
    label: 'Users',
    icon: Users,
    roles: ['super_admin'],
  },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

interface Props {
  role: UserRole
  open?: boolean
  onClose?: () => void
}

export default function Sidebar({ role, open, onClose }: Props) {
  const pathname = usePathname()

  const visible = navItems.filter(
    (item) => !item.roles || item.roles.includes(role)
  )

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'w-60 bg-gradient-to-b from-[#091124] via-[#0d162c] to-[#050b18] border-r border-white/5 flex flex-col shrink-0 transition-transform duration-200 z-50',
          'fixed inset-y-0 left-0 lg:relative lg:translate-x-0 lg:flex',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo and Mobile Close */}
        <div className="px-6 py-6 border-b border-white/10 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
            <div className="w-8 h-8 rounded-lg bg-ms-red flex items-center justify-center shrink-0 shadow-lg shadow-ms-red/40 animate-pulse">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="text-white font-bold text-lg tracking-tight">Modeshare</span>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <X size={18} />
          </button>
        </div>
        
        <div className="px-6 py-2.5 flex items-center gap-2 mt-2">
          <Share2 size={12} className="text-slate-400" />
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Social Publisher</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-4 space-y-1.5">
          {visible.map((item) => {
            const active =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                  active
                    ? 'bg-gradient-to-r from-ms-red to-red-500 text-white shadow-lg shadow-ms-red/25 font-semibold'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                )}
              >
                <item.icon size={18} className={cn(active ? 'text-white' : 'text-slate-400')} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-white/10 bg-black/20">
          <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider text-center">Internal use only</p>
        </div>
      </aside>
    </>
  )
}
