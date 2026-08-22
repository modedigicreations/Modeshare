'use client'

import { useState } from 'react'
import { Profile, UserRole } from '@/types/database'
import { Card, CardBody } from '@/components/ui/Card'
import { formatDateTime } from '@/lib/utils'
import { ROLE_LABELS } from '@/lib/utils'
import {
  Users,
  Search,
  AlertCircle,
  Loader2,
} from 'lucide-react'

interface Connection {
  user_id: string
  profile_ids: unknown
}

interface Props {
  currentUserId: string
  initialProfiles: Profile[]
  initialConnections: Connection[]
}

const PLATFORM_COLORS: Record<string, string> = {
  facebook: 'bg-blue-50 text-blue-700 border-blue-100',
  twitter: 'bg-sky-50 text-sky-700 border-sky-100',
  linkedin: 'bg-indigo-50 text-indigo-700 border-indigo-100',
}

const ROLE_ICONS: Record<UserRole, string> = {
  creator: '📝',
  approver: '✅',
  admin: '🔑',
  super_admin: '👑',
}

export default function UsersClient({ currentUserId, initialProfiles, initialConnections }: Props) {
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles)
  const [search, setSearch] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  // Map user_id to connection details
  const connectionsMap = new Map<string, string[]>()
  for (const conn of initialConnections) {
    if (conn.profile_ids && typeof conn.profile_ids === 'object') {
      const keys = Object.keys(conn.profile_ids)
      if (keys.length > 0) {
        connectionsMap.set(conn.user_id, keys)
      }
    }
  }

  // Filter list
  const filtered = profiles.filter((p) => {
    const term = search.toLowerCase()
    return (
      (p.full_name || '').toLowerCase().includes(term) ||
      p.email.toLowerCase().includes(term)
    )
  })

  // Role update handler
  async function handleRoleChange(userId: string, newRole: UserRole) {
    if (userId === currentUserId) {
      alert('Security lock: You cannot change your own role to prevent lockout.')
      return
    }

    setUpdatingId(userId)
    setApiError(null)

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update role')

      // Update local state
      setProfiles((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, role: newRole } : p))
      )
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* Overview Stat Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-900">{profiles.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Total Accounts Registered</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-ms-blue/5 flex items-center justify-center text-ms-blue">
              <Users size={18} />
            </div>
          </div>
        </Card>
      </div>

      {/* Control Actions & Error Banners */}
      <div className="space-y-3">
        {apiError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            <AlertCircle size={16} className="shrink-0" />
            <span>{apiError}</span>
          </div>
        )}

        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 pointer-events-none">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ms-blue focus:border-transparent transition bg-white"
          />
        </div>
      </div>

      {/* Directory Table */}
      <Card>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-5 py-3.5 font-semibold text-gray-600">User</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-600">Connected Channels</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-600">Registered</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-600 text-right">Role Management</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-gray-400">
                      No matching user accounts found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => {
                    const initials = u.full_name
                      ? u.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
                      : u.email[0].toUpperCase()

                    const connectedPlatforms = connectionsMap.get(u.id) || []
                    const isSelf = u.id === currentUserId
                    const loading = updatingId === u.id

                    return (
                      <tr key={u.id} className="hover:bg-gray-50/30 transition">
                        {/* User Details */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-700 font-bold text-xs shrink-0">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-800 flex items-center gap-1.5">
                                {u.full_name || '—'}
                                {isSelf && (
                                  <span className="text-[10px] bg-gray-100 text-gray-500 border border-gray-200 px-1.5 py-0.5 rounded-full font-bold">
                                    You
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-gray-400 truncate">{u.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* Buffer connections */}
                        <td className="px-5 py-4">
                          {connectedPlatforms.length > 0 ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {connectedPlatforms.map((p) => (
                                <span
                                  key={p}
                                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border capitalize ${PLATFORM_COLORS[p] || 'bg-gray-100 text-gray-600'}`}
                                >
                                  {p}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">Not connected</span>
                          )}
                        </td>

                        {/* Date Registered */}
                        <td className="px-5 py-4 text-xs text-gray-500 font-mono">
                          {formatDateTime(u.created_at)}
                        </td>

                        {/* Role selection dropdown */}
                        <td className="px-5 py-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            {loading && <Loader2 size={13} className="text-ms-blue animate-spin" />}
                            <select
                              value={u.role}
                              disabled={isSelf || loading}
                              onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                              className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ms-blue focus:border-transparent transition bg-white disabled:bg-gray-50 disabled:text-gray-400"
                            >
                              {(['creator', 'approver', 'admin', 'super_admin'] as UserRole[]).map((r) => (
                                <option key={r} value={r}>
                                  {ROLE_ICONS[r]} {ROLE_LABELS[r]}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
