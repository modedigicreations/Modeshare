'use client'

import { useState } from 'react'
import { UserRole } from '@/types/database'
import { updateRoleAction } from '@/app/auth/actions'
import { Loader2 } from 'lucide-react'

interface Props {
  currentRole: UserRole
}

export default function RoleSwitcher({ currentRole }: Props) {
  const [role, setRole] = useState<UserRole>(currentRole)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRoleChange(newRole: UserRole) {
    setIsUpdating(true)
    setError(null)
    setRole(newRole)

    const res = await updateRoleAction(newRole)
    if (res.success) {
      // Reload page to refresh Layout-level data and router permissions
      window.location.reload()
    } else {
      setError(res.error || 'Failed to update role')
      setRole(currentRole) // Revert
      setIsUpdating(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <select
          value={role}
          onChange={(e) => handleRoleChange(e.target.value as UserRole)}
          disabled={isUpdating}
          className="text-sm font-medium bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-gray-800 shadow-sm focus:outline-none focus:ring-1 focus:ring-ms-blue focus:border-ms-blue disabled:opacity-60"
        >
          <option value="creator">Creator</option>
          <option value="approver">Approver</option>
          <option value="admin">Admin</option>
          <option value="super_admin">Super Admin</option>
        </select>
        {isUpdating && <Loader2 size={14} className="animate-spin text-ms-blue" />}
      </div>
      {error && <p className="text-[10px] text-red-500">{error}</p>}
    </div>
  )
}
