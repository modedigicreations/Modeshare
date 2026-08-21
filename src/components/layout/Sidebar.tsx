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
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

interface Props {
  role: UserRole
}

export default function Sidebar({ role }: Props) {
  const pathname = usePathname()

  const visible = navItems.filter(
    (item) => !item.roles || item.roles.includes(role)
  )

  return (
    <aside className="w-60 bg-ms-blue-dark flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-ms-red flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <span className="text-white font-bold text-lg tracking-tight">Modeshare</span>
        </Link>
        <div className="flex items-center gap-1.5 mt-2 ml-10">
          <Share2 size={11} className="text-blue-300" />
          <span className="text-blue-300 text-xs">Social Publisher</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {visible.map((item) => {
          const active =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-ms-red text-white'
                  : 'text-blue-200 hover:bg-white/10 hover:text-white'
              )}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/10">
        <p className="text-blue-400 text-xs text-center">Internal use only</p>
      </div>
    </aside>
  )
}
