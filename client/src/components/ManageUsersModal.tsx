import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2, X } from 'lucide-react'
import { ApiError, endpoints, type ManagedUser, type Role } from '../lib/api.ts'
import { useAppStore } from '../store/useAppStore.ts'
import { useCurrentUser } from '../hooks/useAuth.ts'
import { Btn, Field, Spinner, inputClass, inputStyle } from './ui.tsx'

const USERS_KEY = ['auth', 'users'] as const

function reason(err: unknown, fallback: string) {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}

export function ManageUsersModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const me = useCurrentUser()
  const askConfirm = useAppStore((s) => s.askConfirm)
  const users = useQuery({ queryKey: USERS_KEY, queryFn: endpoints.listUsers })

  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('user')
  const [error, setError] = useState<string | null>(null)

  const refresh = () => qc.invalidateQueries({ queryKey: USERS_KEY })

  const createUser = useMutation({
    mutationFn: endpoints.createUser,
    onSuccess: () => {
      setEmail('')
      setName('')
      setPassword('')
      setRole('user')
      setError(null)
      void refresh()
    },
    onError: (err) => setError(reason(err, 'Could not create that account.')),
  })

  const removeUser = useMutation({
    mutationFn: endpoints.deleteUser,
    onSuccess: () => void refresh(),
    onError: (err) => setError(reason(err, 'Could not remove that account.')),
  })

  const changeRole = useMutation({
    mutationFn: ({ id, nextRole }: { id: string; nextRole: Role }) =>
      endpoints.updateUser(id, { role: nextRole }),
    onSuccess: () => void refresh(),
    onError: (err) => setError(reason(err, 'Could not change that role.')),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Use at least 8 characters for the password.')
      return
    }
    createUser.mutate({ email, password, name: name.trim() || undefined, role })
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: 'var(--present-scrim)' }}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-[14px]"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
      >
        <header
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div>
            <div className="text-heading">Accounts</div>
            <div className="text-caption" style={{ color: 'var(--text-secondary)' }}>
              Team members can add songs and run Present mode. Admins can also delete and manage backgrounds.
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ color: 'var(--text-secondary)' }}>
            <X size={16} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {users.isPending ? (
            <Spinner />
          ) : users.isError ? (
            <p className="text-body" style={{ color: 'var(--danger)' }}>
              {reason(users.error, 'Could not load the account list.')}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {users.data?.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  isSelf={user.id === me?.id}
                  onChangeRole={(nextRole) => changeRole.mutate({ id: user.id, nextRole })}
                  onRemove={() =>
                    askConfirm({
                      title: `Remove ${user.name || user.email}?`,
                      message: 'They lose access immediately. Songs and setlists they added stay.',
                      danger: true,
                      confirmLabel: 'Remove',
                      onConfirm: () => removeUser.mutate(user.id),
                    })
                  }
                />
              ))}
            </ul>
          )}

          <form onSubmit={submit} className="mt-5 flex flex-col gap-3" style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <div className="text-label" style={{ color: 'var(--text-muted)' }}>
              Add someone
            </div>
            <Field label="Email">
              <input
                className={inputClass}
                style={inputStyle}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Name">
              <input
                className={inputClass}
                style={inputStyle}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Optional"
              />
            </Field>
            <Field label="Temporary password">
              <input
                className={inputClass}
                style={inputStyle}
                type="text"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </Field>
            <Field label="Role">
              <select
                className={inputClass}
                style={inputStyle}
                value={role}
                onChange={(e) => setRole(e.target.value === 'admin' ? 'admin' : 'user')}
              >
                <option value="user">Team member</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
            <p className="text-caption" style={{ color: 'var(--text-muted)' }}>
              Share this password with them directly — they can change it after signing in.
            </p>
            {error ? (
              <p role="alert" className="text-body" style={{ color: 'var(--danger)' }}>
                {error}
              </p>
            ) : null}
            <Btn accent type="submit" busy={createUser.isPending} disabled={createUser.isPending}>
              Add account
            </Btn>
          </form>
        </div>
      </div>
    </div>
  )
}

function UserRow({
  user,
  isSelf,
  onChangeRole,
  onRemove,
}: {
  user: ManagedUser
  isSelf: boolean
  onChangeRole: (role: Role) => void
  onRemove: () => void
}) {
  return (
    <li
      className="flex items-center gap-3 rounded-[10px] px-3 py-2"
      style={{ background: 'var(--surface-2)' }}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-label" style={{ color: 'var(--text-primary)' }}>
          {user.name || user.email}
          {isSelf ? ' (you)' : ''}
        </div>
        <div className="truncate text-caption" style={{ color: 'var(--text-muted)' }}>
          {user.email}
        </div>
      </div>
      <select
        className="h-8 rounded-[8px] px-2 text-[12px]"
        style={inputStyle}
        value={user.role}
        disabled={isSelf}
        title={isSelf ? 'You cannot change your own role.' : 'Change role'}
        onChange={(e) => onChangeRole(e.target.value === 'admin' ? 'admin' : 'user')}
      >
        <option value="user">Team member</option>
        <option value="admin">Admin</option>
      </select>
      <button
        type="button"
        onClick={onRemove}
        disabled={isSelf}
        aria-label={`Remove ${user.email}`}
        title={isSelf ? 'You cannot remove your own account.' : 'Remove'}
        style={{ color: isSelf ? 'var(--text-muted)' : 'var(--danger)' }}
      >
        <Trash2 size={14} />
      </button>
    </li>
  )
}
