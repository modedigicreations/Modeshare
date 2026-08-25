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
  const [apiError, setApiError] = useState<string | null>(null)

  // Edit user modal state
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [editEmail, setEditEmail] = useState('')
  const [editFullName, setEditFullName] = useState('')
  const [editRole, setEditRole] = useState<UserRole>('creator')
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

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

  // Start editing user
  function startEdit(user: Profile) {
    setEditingUser(user)
    setEditEmail(user.email)
    setEditFullName(user.full_name || '')
    setEditRole(user.role)
    setEditError(null)
  }

  // Handle edit submission
  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingUser) return

    setEditLoading(true)
    setEditError(null)

    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: editEmail,
          fullName: editFullName,
          role: editRole,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update user profile')

      // Update local state
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === editingUser.id
            ? { ...p, email: editEmail, full_name: editFullName, role: editRole }
            : p
        )
      )

      // Close modal
      setEditingUser(null)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setEditLoading(false)
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
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ms-blue focus:border-transparent transition bg-white shadow-xs"
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
                  <th className="px-5 py-3.5 font-semibold text-gray-600">User Details</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-600">Connected Channels</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-600">Registered</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-600 text-right">Actions</th>
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

                    return (
                      <tr key={u.id} className="hover:bg-gray-50/30 transition">
                        {/* User Details */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-slate-100 to-slate-200 border border-slate-300/40 flex items-center justify-center text-slate-700 font-bold text-xs shrink-0 shadow-xs">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-700 flex items-center gap-2 flex-wrap">
                                {u.full_name || '—'}
                                {isSelf && (
                                  <span className="text-[9px] bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded-full font-bold">
                                    You
                                  </span>
                                )}
                                <span className="text-[10px] bg-slate-50 text-slate-600 border border-slate-200/50 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                  <span>{ROLE_ICONS[u.role]}</span>
                                  <span>{ROLE_LABELS[u.role]}</span>
                                </span>
                              </p>
                              <p className="text-xs text-slate-400 truncate mt-0.5">{u.email}</p>
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
                            <span className="text-xs text-slate-400">Not connected</span>
                          )}
                        </td>

                        {/* Date Registered */}
                        <td className="px-5 py-4 text-xs text-slate-500 font-mono">
                          {formatDateTime(u.created_at)}
                        </td>

                        {/* Action buttons */}
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => startEdit(u)}
                            className="px-3.5 py-1.5 border border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 rounded-xl text-xs font-semibold text-slate-600 transition shadow-xs cursor-pointer"
                          >
                            Edit Profile
                          </button>
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

      {/* Edit User Modal Overlay */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Edit User Profile</h3>
              <p className="text-xs text-slate-400">Update registered email, name, or platform role.</p>
            </div>

            {editError && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl p-3 flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Full Name</label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ms-blue focus:border-transparent transition bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ms-blue focus:border-transparent transition bg-white"
                />
                <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                  ⚠️ Changing this email updates the user's login credential. They will log in using this new email with their existing password.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Platform Role</label>
                <select
                  value={editRole}
                  disabled={editingUser.id === currentUserId}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ms-blue focus:border-transparent transition disabled:bg-slate-50 disabled:text-slate-400"
                >
                  {(['creator', 'approver', 'admin', 'super_admin'] as UserRole[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_ICONS[r]} {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
                {editingUser.id === currentUserId && (
                  <p className="text-[10px] text-amber-600 mt-1 leading-normal">You cannot modify your own role to prevent lockout.</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  disabled={editLoading}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 bg-ms-blue hover:bg-ms-blue-dark text-white rounded-xl text-sm font-semibold transition flex items-center gap-1.5 disabled:opacity-60"
                >
                  {editLoading && <Loader2 size={14} className="animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
