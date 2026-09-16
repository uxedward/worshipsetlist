import { useState, type FormEvent, type ReactNode } from 'react'
import { Eye, EyeOff, Loader2, Music4 } from 'lucide-react'
import {
  useCompleteReset,
  useLogin,
  useResetToken,
  useSetupAdmin,
  clearResetTokenFromUrl,
} from '../hooks/useAuth.ts'
import { ApiError } from '../lib/api.ts'
import { Field, inputClass, inputStyle } from './ui.tsx'

export const MIN_PASSWORD = 8

function message(err: unknown, fallback: string) {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}

/** Shared rules so the form and the server never disagree about a password. */
export function newPasswordProblem(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`
  if (password !== confirm) return 'Those passwords do not match.'
  return null
}

export function AuthScreen({
  needsSetup,
  resetToken,
  onResetDone,
  checking,
  loadError,
}: {
  needsSetup: boolean
  resetToken: string | null
  onResetDone: () => void
  checking?: boolean
  loadError?: string | null
}) {
  if (resetToken) return <ResetPasswordPanel token={resetToken} onDone={onResetDone} />
  if (checking) return <CheckingPanel />
  if (needsSetup) return <CreateAdminPanel />
  return <SignInPanel loadError={loadError} />
}

/* ------------------------------------------------------------------- shell */

function AuthShell({
  title,
  blurb,
  children,
  footer,
}: {
  title: string
  blurb: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div
      className="flex h-full flex-col items-center justify-center overflow-y-auto p-6"
      style={{ background: 'var(--canvas)', color: 'var(--text-primary)' }}
    >
      <div className="w-full max-w-sm py-6">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-[14px]"
            style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}
          >
            <Music4 size={20} />
          </div>
          <div className="font-display" style={{ color: 'var(--accent)', fontSize: 26, lineHeight: 1.2 }}>
            Setflow
          </div>
        </div>
        <div
          className="flex flex-col gap-4 rounded-2xl p-6"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
        >
          <div className="flex flex-col gap-1">
            <h1 className="text-title">{title}</h1>
            <p className="text-body" style={{ color: 'var(--text-secondary)' }}>
              {blurb}
            </p>
          </div>
          {children}
        </div>
        {footer ? (
          <div className="mt-4 text-center text-body" style={{ color: 'var(--text-secondary)' }}>
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="text-body" style={{ color: 'var(--danger)' }}>
      {children}
    </p>
  )
}

function SubmitButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button type="submit" className="btn-primary flex items-center justify-center gap-2" disabled={busy}>
      {busy ? <Loader2 size={14} className="animate-spin" /> : null}
      {children}
    </button>
  )
}

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  autoFocus,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: string
  placeholder?: string
  autoFocus?: boolean
}) {
  const [visible, setVisible] = useState(false)
  return (
    <Field label={label}>
      <div className="relative">
        <input
          className={inputClass}
          style={{ ...inputStyle, paddingRight: 40 }}
          type={visible ? 'text' : 'password'}
          required
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          style={{ color: 'var(--text-muted)' }}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </Field>
  )
}

function CheckingPanel() {
  return (
    <AuthShell title="Welcome to Setflow" blurb="Getting your sign-in ready.">
      <div className="flex items-center gap-2 text-body" style={{ color: 'var(--text-secondary)' }}>
        <Loader2 size={16} className="animate-spin" />
        Almost there
      </div>
    </AuthShell>
  )
}

/* --------------------------------------------------------- first run: admin */

function CreateAdminPanel() {
  const setup = useSetupAdmin()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setLocalError('A name is required.')
      return
    }
    const problem = newPasswordProblem(password, confirm)
    setLocalError(problem)
    if (problem) return
    setup.mutate({ email, password, name: name.trim() })
  }

  return (
    <AuthShell
      title="Create your admin account"
      blurb="You're first, so this account runs the library, Present, and who else can sign in. It only takes a few seconds."
      footer="Add the rest of the team from Settings → Accounts. They get a link to choose their own password."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="Your name">
          <input
            className={inputClass}
            style={inputStyle}
            autoFocus
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jordan"
          />
        </Field>
        <Field label="Email">
          <input
            className={inputClass}
            style={inputStyle}
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <PasswordField
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          placeholder={`At least ${MIN_PASSWORD} characters`}
        />
        <PasswordField
          label="Confirm password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
        />
        <ErrorNote>{localError ?? (setup.error ? message(setup.error, 'Could not create that account.') : null)}</ErrorNote>
        <SubmitButton busy={setup.isPending}>Create admin account</SubmitButton>
      </form>
    </AuthShell>
  )
}

/* ----------------------------------------------------------------- sign in */

function SignInPanel({ loadError }: { loadError?: string | null }) {
  const login = useLogin()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showHelp, setShowHelp] = useState(false)

  return (
    <AuthShell
      title="Sign in"
      blurb="Your team's songs, charts, and Present mode."
      footer={
        showHelp ? (
          <span>
            Ask an admin to open <strong>Settings → Accounts</strong> and send you a link. Links last 24 hours.
          </span>
        ) : (
          <button type="button" onClick={() => setShowHelp(true)} style={{ color: 'var(--accent)' }}>
            Forgot your password?
          </button>
        )
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          login.mutate({ email, password })
        }}
        className="flex flex-col gap-4"
      >
        <Field label="Email">
          <input
            className={inputClass}
            style={inputStyle}
            type="email"
            required
            autoFocus
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <PasswordField
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
        <ErrorNote>
          {login.error ? message(login.error, 'Could not sign you in.') : loadError ?? null}
        </ErrorNote>
        <SubmitButton busy={login.isPending}>Sign in</SubmitButton>
      </form>
    </AuthShell>
  )
}

/* ----------------------------------------------------------- password reset */

function ResetPasswordPanel({ token, onDone }: { token: string; onDone: () => void }) {
  const check = useResetToken(token)
  const complete = useCompleteReset()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  if (check.isPending) {
    return (
      <AuthShell title="Checking your link" blurb="This should only take a moment.">
        <Loader2 size={16} className="animate-spin" />
      </AuthShell>
    )
  }

  if (check.isError) {
    return (
      <AuthShell
        title="That link will not work"
        blurb={message(check.error, 'That reset link is not valid.')}
        footer="Ask an admin for a fresh one — links last 24 hours and only work once."
      >
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            clearResetTokenFromUrl()
            onDone()
          }}
        >
          Back to sign in
        </button>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Set your password"
      blurb={`This is how you'll sign in as ${check.data?.email}.`}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const problem = newPasswordProblem(password, confirm)
          setLocalError(problem)
          if (problem) return
          complete.mutate({ token, password }, { onSuccess: onDone })
        }}
        className="flex flex-col gap-4"
      >
        <PasswordField
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          autoFocus
          placeholder={`At least ${MIN_PASSWORD} characters`}
        />
        <PasswordField
          label="Confirm password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
        />
        <ErrorNote>
          {localError ?? (complete.error ? message(complete.error, 'Could not set that password.') : null)}
        </ErrorNote>
        <SubmitButton busy={complete.isPending}>Save and sign in</SubmitButton>
      </form>
    </AuthShell>
  )
}
