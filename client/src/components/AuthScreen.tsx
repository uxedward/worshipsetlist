import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { useLogin, useSetupAdmin } from '../hooks/useAuth.ts'
import { ApiError } from '../lib/api.ts'
import { Field, inputClass, inputStyle } from './ui.tsx'

function message(err: unknown, fallback: string) {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}

/** Sign-in, plus the one-time screen that claims the first admin account. */
export function AuthScreen({ needsSetup }: { needsSetup: boolean }) {
  const login = useLogin()
  const setup = useSetupAdmin()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [confirm, setConfirm] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const pending = login.isPending || setup.isPending
  const error =
    localError ??
    (login.error ? message(login.error, 'Could not sign you in.') : null) ??
    (setup.error ? message(setup.error, 'Could not create that account.') : null)

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setLocalError(null)
    if (!needsSetup) {
      login.mutate({ email, password })
      return
    }
    if (password.length < 8) {
      setLocalError('Use at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setLocalError('Those passwords do not match.')
      return
    }
    setup.mutate({ email, password, name: name.trim() || undefined })
  }

  return (
    <div
      className="flex h-full flex-col items-center justify-center p-6"
      style={{ background: 'var(--canvas)', color: 'var(--text-primary)' }}
    >
      <form
        onSubmit={onSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl p-6"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
      >
        <div className="flex flex-col gap-1">
          <h1 className="text-title">{needsSetup ? 'Set up Setflow' : 'Sign in to Setflow'}</h1>
          <p className="text-body" style={{ color: 'var(--text-secondary)' }}>
            {needsSetup
              ? 'Create the admin account. You can add the rest of your team once you are in.'
              : 'Your worship team library, charts, and Present mode.'}
          </p>
        </div>

        {needsSetup ? (
          <Field label="Name">
            <input
              className={inputClass}
              style={inputStyle}
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Worship Leader"
            />
          </Field>
        ) : null}

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

        <Field label="Password">
          <input
            className={inputClass}
            style={inputStyle}
            type="password"
            required
            autoComplete={needsSetup ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        {needsSetup ? (
          <Field label="Confirm password">
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
        ) : null}

        {error ? (
          <p role="alert" className="text-body" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn-primary flex items-center justify-center gap-2" disabled={pending}>
          {pending ? <Loader2 size={14} className="animate-spin" /> : null}
          {needsSetup ? 'Create admin account' : 'Sign in'}
        </button>

        {!needsSetup ? (
          <p className="text-center text-body" style={{ color: 'var(--text-secondary)' }}>
            Need an account? Ask your admin to add you.
          </p>
        ) : null}
      </form>
    </div>
  )
}
