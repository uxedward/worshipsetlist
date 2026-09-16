import { LogOut, Settings } from 'lucide-react'
import { useCurrentUser, useLogout } from '../hooks/useAuth.ts'
import { useAppStore } from '../store/useAppStore.ts'

export function AccountMenu() {
  const user = useCurrentUser()
  const logout = useLogout()
  const openSettings = useAppStore((s) => s.openSettingsPage)
  if (!user) return null

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
          {user.role === 'admin' ? 'Admin' : 'Team member'}
        </div>
      </div>
      <button
        type="button"
        onClick={openSettings}
        title="Settings"
        aria-label="Settings"
        className="flex h-7 w-7 items-center justify-center rounded-[8px]"
        style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
      >
        <Settings size={14} />
      </button>
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
    </div>
  )
}
