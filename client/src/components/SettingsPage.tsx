import { useState, type FormEvent, type ReactNode } from 'react'
import { Check, Copy, KeyRound, Trash2, X } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, endpoints, type ManagedUser, type Role } from '../lib/api.ts'
import { useAppStore } from '../store/useAppStore.ts'
import { useChangePassword, useCurrentUser, useUpdateProfile } from '../hooks/useAuth.ts'
import { useMutations, usePreferences } from '../hooks/useQueries.ts'
import { Btn, Field, Spinner, inputClass, inputStyle } from './ui.tsx'
import { MIN_PASSWORD, newPasswordProblem } from './AuthScreen.tsx'
import type { PresentationFontSize, Theme } from '@shared/types.ts'

const USERS_KEY = ['auth', 'users'] as const

function reason(err: unknown, fallback: string) {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}

type Tab = 'account' | 'appearance' | 'team'

export function SettingsPage() {
  const open = useAppStore((s) => s.settingsPageOpen)
  const close = useAppStore((s) => s.closeSettingsPage)
  const me = useCurrentUser()
  const [tab, setTab] = useState<Tab>('account')
  if (!open || !me) return null
  const isAdmin = me.role === 'admin'

  return (
    <div className="fixed inset-0 z-[78] flex items-center justify-center p-4" style={{ background: 'var(--present-scrim)' }}>
      <div
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-[14px]"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
      >
        <header className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="text-heading">Settings</div>
          <button type="button" onClick={close} aria-label="Close settings" style={{ color: 'var(--text-secondary)' }}>
            <X size={16} />
          </button>
        </header>

        <nav className="flex gap-1 px-4 pt-3" role="tablist">
          <TabButton active={tab === 'account'} onClick={() => setTab('account')}>
            Account
          </TabButton>
          <TabButton active={tab === 'appearance'} onClick={() => setTab('appearance')}>
            Appearance
          </TabButton>
          {isAdmin ? (
            <TabButton active={tab === 'team'} onClick={() => setTab('team')}>
              Accounts
            </TabButton>
          ) : null}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-4">
          {tab === 'account' ? <AccountSection /> : null}
          {tab === 'appearance' ? <AppearanceSection /> : null}
          {tab === 'team' && isAdmin ? <TeamSection /> : null}
        </div>
      </div>
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="rounded-[8px] px-3 py-1.5 text-label"
      style={{
        background: active ? 'var(--accent-bg)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
      }}
    >
      {children}
    </button>
  )
}

function Section({ title, blurb, children }: { title: string; blurb?: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-label" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h2>
      {blurb ? (
        <p className="mt-0.5 text-caption" style={{ color: 'var(--text-muted)' }}>
          {blurb}
        </p>
      ) : null}
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </section>
  )
}

function Note({ tone, children }: { tone: 'ok' | 'bad'; children: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="text-body" style={{ color: tone === 'ok' ? 'var(--accent)' : 'var(--danger)' }}>
      {children}
    </p>
  )
}

/* ---------------------------------------------------------------- account */

function AccountSection() {
  const me = useCurrentUser()!
  const updateProfile = useUpdateProfile()
  const changePassword = useChangePassword()
  const [name, setName] = useState(me.name)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwDone, setPwDone] = useState(false)

  function submitPassword(event: FormEvent) {
    event.preventDefault()
    setPwDone(false)
    const problem = newPasswordProblem(next, confirm)
    setPwError(problem)
    if (problem) return
    changePassword.mutate(
      { currentPassword: current, password: next },
      {
        onSuccess: () => {
          setCurrent('')
          setNext('')
          setConfirm('')
          setPwError(null)
          setPwDone(true)
        },
        onError: (err) => setPwError(reason(err, 'Could not change your password.')),
      },
    )
  }

  return (
    <>
      <Section title="Profile">
        <Field label="Email">
          <input className={inputClass} style={{ ...inputStyle, opacity: 0.7 }} value={me.email} disabled />
        </Field>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) updateProfile.mutate(name.trim())
          }}
        >
          <div className="flex-1">
            <Field label="Display name">
              <input className={inputClass} style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          </div>
          <Btn type="submit" busy={updateProfile.isPending} disabled={!name.trim() || name.trim() === me.name}>
            Save
          </Btn>
        </form>
        <div className="text-caption" style={{ color: 'var(--text-muted)' }}>
          You are signed in as {me.role === 'admin' ? 'an admin' : 'a team member'}.
        </div>
      </Section>

      <Section title="Password" blurb={`At least ${MIN_PASSWORD} characters.`}>
        <form onSubmit={submitPassword} className="flex flex-col gap-3">
          <Field label="Current password">
            <input
              className={inputClass}
              style={inputStyle}
              type="password"
              required
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </Field>
          <Field label="New password">
            <input
              className={inputClass}
              style={inputStyle}
              type="password"
              required
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </Field>
          <Field label="Confirm new password">
            <input
              className={inputClass}
              style={inputStyle}
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          <Note tone="bad">{pwError}</Note>
          {pwDone ? <Note tone="ok">Password changed.</Note> : null}
          <div>
            <Btn accent type="submit" busy={changePassword.isPending}>
              Change password
            </Btn>
          </div>
        </form>
      </Section>
    </>
  )
}

/* ------------------------------------------------------------- appearance */

const FONT_SIZES: PresentationFontSize[] = ['small', 'medium', 'large']

function AppearanceSection() {
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const fontSize = useAppStore((s) => s.fontSize)
  const setFontSize = useAppStore((s) => s.setFontSize)
  const { patchPrefs } = useMutations()
  const prefs = usePreferences()

  return (
    <>
      <Section title="Theme" blurb="Saved to your account, so it follows you to any device.">
        <div className="flex gap-2">
          {(['dark', 'light'] as Theme[]).map((option) => (
            <Btn key={option} accent={theme === option} onClick={() => setTheme(option)}>
              {option === 'dark' ? 'Dark' : 'Light'}
            </Btn>
          ))}
        </div>
      </Section>

      <Section title="Present mode text size" blurb="The starting size for lyrics on the screen.">
        <div className="flex gap-2">
          {FONT_SIZES.map((size) => (
            <Btn
              key={size}
              accent={fontSize === size}
              onClick={() => {
                setFontSize(size)
                patchPrefs.mutate({ presentationFontSize: size })
              }}
            >
              {size[0].toUpperCase() + size.slice(1)}
            </Btn>
          ))}
        </div>
        {prefs.isError ? <Note tone="bad">Could not load your saved preferences.</Note> : null}
      </Section>
    </>
  )
}

/* ------------------------------------------------------------------- team */

function TeamSection() {
  const qc = useQueryClient()
  const me = useCurrentUser()!
  const askConfirm = useAppStore((s) => s.askConfirm)
  const users = useQuery({ queryKey: USERS_KEY, queryFn: endpoints.listUsers })

  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('user')
  const [error, setError] = useState<string | null>(null)
  const [inviteLink, setInviteLink] = useState<{ email: string; link: string } | null>(null)

  const refresh = () => qc.invalidateQueries({ queryKey: USERS_KEY })

  const createUser = useMutation({
    mutationFn: endpoints.createUser,
    onSuccess: (data) => {
      setEmail('')
      setName('')
      setRole('user')
      setError(null)
      setInviteLink({ email: data.email, link: data.link })
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
    mutationFn: ({ id, nextRole }: { id: string; nextRole: Role }) => endpoints.updateUser(id, { role: nextRole }),
    onSuccess: () => void refresh(),
    onError: (err) => setError(reason(err, 'Could not change that role.')),
  })

  const makeResetLink = useMutation({
    mutationFn: endpoints.createResetLink,
    onSuccess: (data) => {
      setError(null)
      setInviteLink({ email: data.email, link: data.link })
    },
    onError: (err) => setError(reason(err, 'Could not create a reset link.')),
  })

  return (
    <>
      <Section title="Who has access" blurb="Team members add songs and run Present mode. Admins can also delete and manage backgrounds.">
        {users.isPending ? (
          <Spinner />
        ) : users.isError ? (
          <Note tone="bad">{reason(users.error, 'Could not load the account list.')}</Note>
        ) : (
          <ul className="flex flex-col gap-2">
            {users.data?.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                isSelf={user.id === me.id}
                busy={makeResetLink.isPending}
                onChangeRole={(nextRole) => changeRole.mutate({ id: user.id, nextRole })}
                onResetLink={() => makeResetLink.mutate(user.id)}
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
        <Note tone="bad">{error}</Note>
        {inviteLink ? (
          <ResetLinkPanel
            email={inviteLink.email}
            link={inviteLink.link}
            kind="invite"
            onDismiss={() => setInviteLink(null)}
          />
        ) : null}
      </Section>

      <Section title="Add someone" blurb="There is no public sign-up. They get a link to set their own password, so you never have to invent one.">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setError(null)
            if (!name.trim()) {
              setError('A name is required.')
              return
            }
            createUser.mutate({ email, name: name.trim(), role })
          }}
          className="flex flex-col gap-3"
        >
          <Field label="Name">
            <input className={inputClass} style={inputStyle} required value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex" />
          </Field>
          <Field label="Email">
            <input className={inputClass} style={inputStyle} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
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
          <div>
            <Btn accent type="submit" busy={createUser.isPending}>
              Create invite link
            </Btn>
          </div>
        </form>
      </Section>
    </>
  )
}

function ResetLinkPanel({
  email,
  link,
  kind = 'reset',
  onDismiss,
}: {
  email: string
  link: string
  kind?: 'invite' | 'reset'
  onDismiss: () => void
}) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-col gap-2 rounded-[10px] p-3" style={{ background: 'var(--accent-bg)' }}>
      <div className="text-label" style={{ color: 'var(--accent)' }}>
        {kind === 'invite' ? `Invite link for ${email}` : `One-time reset link for ${email}`}
      </div>
      <div className="text-caption" style={{ color: 'var(--text-secondary)' }}>
        Send this to them directly. It works once, expires in 24 hours, and lets them choose their own password.
      </div>
      <div className="flex items-center gap-2">
        <input className={inputClass} style={inputStyle} readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
        <Btn
          onClick={() => {
            void navigator.clipboard
              ?.writeText(link)
              .then(() => setCopied(true))
              .catch(() => setCopied(false))
          }}
        >
          <span className="inline-flex items-center gap-1">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </span>
        </Btn>
        <Btn ghost onClick={onDismiss}>
          Done
        </Btn>
      </div>
    </div>
  )
}

function UserRow({
  user,
  isSelf,
  busy,
  onChangeRole,
  onResetLink,
  onRemove,
}: {
  user: ManagedUser
  isSelf: boolean
  busy: boolean
  onChangeRole: (role: Role) => void
  onResetLink: () => void
  onRemove: () => void
}) {
  return (
    <li className="flex items-center gap-2 rounded-[10px] px-3 py-2" style={{ background: 'var(--surface-2)' }}>
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
        onClick={onResetLink}
        disabled={busy}
        aria-label={`Send a reset link to ${user.email}`}
        title="Create a one-time reset link"
        style={{ color: 'var(--text-secondary)' }}
      >
        <KeyRound size={14} />
      </button>
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
