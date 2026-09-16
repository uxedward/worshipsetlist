import { useState } from 'react'
import { LogOut, Users } from 'lucide-react'
import { useCurrentUser, useLogout } from '../hooks/useAuth.ts'
import { ManageUsersModal } from './ManageUsersModal.tsx'

export function AccountMenu() {
  const user = useCurrentUser()
  const logout = useLogout()
  const [manageOpen, setManageOpen] = useState(false)
  if (!user) return null
  const isAdmin = user.role === 'admin'

  return (
    <div
      className="flex items-center gap-2 px-5 py-3"
      style={{ borderTop: '1px solid var(--border)' }}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-label" style={{ color: 'var(--text-primary)' }}>
          {user.name || user.email}
        </div>
        <div className="truncate text-caption" style={{ color: 'var(--text-muted)' }}>
          {isAdmin ? 'Admin' : 'Team member'}
        </div>
      </div>
      {isAdmin ? (
        <button
          type="button"
          onClick={() => setManageOpen(true)}
          title="Manage accounts"
          aria-label="Manage accounts"
          className="flex h-7 w-7 items-center justify-center rounded-[8px]"
          style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
        >
          <Users size={14} />
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
        title="Sign out"
        aria-label="Sign out"
        className="flex h-7 w-7 items-center justify-center rounded-[8px]"
        style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
      >
        <LogOut size={14} />
      </button>
      {manageOpen ? <ManageUsersModal onClose={() => setManageOpen(false)} /> : null}
    </div>
  )
}
