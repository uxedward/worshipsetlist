import type { ReactNode } from 'react'
import { cn } from '../lib/cn.ts'
import { displayKey } from '@shared/bulkFormat.ts'
import { useAppStore } from '../store/useAppStore.ts'
import { useRetrySave } from '../hooks/useQueries.ts'
import { energyLevel, energyToken } from '../lib/energyArc.ts'
import { Moon, Sun, X } from 'lucide-react'

const COVER_COUNT = 5

export function KeyBadge({ value }: { value: string; size?: 'sm' | 'md' }) {
  const label = displayKey(value)
  const wide = label.length > 3
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden whitespace-nowrap tabular"
      style={{
        minWidth: 24,
        width: wide ? 'auto' : 24,
        height: 24,
        padding: wide ? '0 8px' : 0,
        borderRadius: 24,
        fontSize: 12,
        lineHeight: 1.4,
        fontWeight: 500,
        background: 'var(--accent-bg)',
        color: 'var(--accent-text)',
      }}
    >
      {label}
    </span>
  )
}

export function SetlistThumb({
  colorIndex,
  size,
  radius,
}: {
  colorIndex: number
  size: number
  radius?: number
}) {
  const idx = Math.abs(colorIndex) % COVER_COUNT
  return (
    <div
      className="relative shrink-0 overflow-hidden"
      style={{
        width: size,
        height: size,
        borderRadius: radius ?? 'var(--radius-lg)',
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
      }}
    >
      <img
        src={`/covers/${idx}.jpg`}
        alt=""
        draggable={false}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
    </div>
  )
}

export function EnergyArc({ bpm }: { bpm: number | null | undefined }) {
  const level = energyLevel(bpm)
  return (
    <span className="inline-flex items-center gap-0.5" title={`Energy ${level} of 5`} aria-label={`Energy ${level} of 5`}>
      {([1, 2, 3, 4, 5] as const).map((step) => (
        <span
          key={step}
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: step <= level ? energyToken(level) : 'var(--border)' }}
        />
      ))}
    </span>
  )
}

export function EqualizerBars() {
  return (
    <div className="flex h-4 items-end gap-[2px]" aria-hidden>
      <span className="eq-bar" />
      <span className="eq-bar" />
      <span className="eq-bar" />
    </div>
  )
}

export function IconBtn({
  children,
  onClick,
  title,
  accent,
  className,
}: {
  children: ReactNode
  onClick?: () => void
  title?: string
  accent?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-[8px] transition-colors',
        className,
      )}
      style={{
        background: accent ? 'var(--accent)' : 'transparent',
        color: accent ? 'var(--on-accent)' : 'var(--text-primary)',
      }}
    >
      {children}
    </button>
  )
}

export function Btn({
  children,
  onClick,
  accent,
  ghost,
  type = 'button',
  disabled,
  className,
}: {
  children: ReactNode
  onClick?: () => void
  accent?: boolean
  ghost?: boolean
  type?: 'button' | 'submit'
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(accent ? 'btn-primary' : 'btn-secondary', className)}
      style={ghost && !accent ? { borderColor: 'transparent' } : undefined}
    >
      {children}
    </button>
  )
}

export function Pill({
  children,
  active,
  onClick,
  accent,
}: {
  children: ReactNode
  active?: boolean
  onClick?: () => void
  accent?: boolean
}) {
  const selected = Boolean(active || accent)
  const style = {
    borderRadius: 'var(--radius-sm)' as const,
    background: selected ? 'var(--accent-bg)' : 'var(--surface-2)',
    color: selected ? 'var(--accent-text)' : 'var(--text-secondary)',
    border: selected ? '1px solid var(--accent-border)' : '1px solid var(--border)',
  }
  const className = 'shrink-0 px-3 py-1 text-caption'
  if (!onClick) {
    return (
      <span className={className} style={style}>
        {children}
      </span>
    )
  }
  return (
    <button type="button" onClick={onClick} className={className} style={style}>
      {children}
    </button>
  )
}

export function ThemeToggle() {
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className="inline-flex h-8 w-8 items-center justify-center rounded-[8px]"
      style={{ color: 'var(--text-secondary)' }}
      aria-label={next === 'light' ? 'Switch to light theme' : 'Switch to dark theme'}
      title={next === 'light' ? 'Light theme' : 'Dark theme'}
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}

export function SaveStatusDot() {
  const status = useAppStore((s) => s.saveStatus)
  const retry = useRetrySave()
  const color =
    status === 'saving' ? 'var(--accent)' : status === 'failed' ? 'var(--danger)' : 'var(--text-muted)'
  return (
    <button
      type="button"
      aria-label={status === 'failed' ? 'Save failed, retry' : status === 'saving' ? 'Saving' : 'Saved'}
      title={status === 'failed' ? 'Save failed — click to retry' : status === 'saving' ? 'Saving' : 'Saved'}
      onClick={() => status === 'failed' && void retry()}
      className="inline-flex items-center gap-1.5 text-caption"
      style={{ color: 'var(--text-secondary)' }}
    >
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      {status === 'saving' ? 'Saving' : status === 'failed' ? 'Retry' : 'Saved'}
    </button>
  )
}

export function OfflineBanner() {
  const offline = useAppStore((s) => s.offline)
  if (!offline) return null
  const noNetwork = typeof navigator !== 'undefined' && navigator.onLine === false
  return (
    <div
      className="z-40 px-4 py-2 text-center text-label"
      style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}
    >
      {noNetwork
        ? 'You’re offline — setlist edits stay on this device'
        : 'Can’t reach the Setflow API — edits stay on this device'}
    </div>
  )
}

export function ConfirmDialog() {
  const confirm = useAppStore((s) => s.confirm)
  const close = useAppStore((s) => s.closeConfirm)
  if (!confirm) return null
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: 'var(--present-scrim)' }}>
      <div
        className="w-full max-w-sm p-5"
        style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <div className="mb-2 flex items-start justify-between">
          <h3 className="text-title">{confirm.title}</h3>
          <button type="button" onClick={close} aria-label="Close" style={{ color: 'var(--text-secondary)' }}>
            <X size={16} />
          </button>
        </div>
        <p className="mb-5 text-body" style={{ color: 'var(--text-secondary)' }}>
          {confirm.message}
        </p>
        <div className="flex justify-end gap-2">
          <Btn ghost onClick={close}>
            Cancel
          </Btn>
          {confirm.danger ? (
            <button
              type="button"
              className="btn-secondary"
              style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
              onClick={() => {
                confirm.onConfirm()
                close()
              }}
            >
              {confirm.confirmLabel || 'Confirm'}
            </button>
          ) : (
            <Btn
              accent
              onClick={() => {
                confirm.onConfirm()
                close()
              }}
            >
              {confirm.confirmLabel || 'Confirm'}
            </Btn>
          )}
        </div>
      </div>
    </div>
  )
}

export function Field({
  label,
  children,
  error,
}: {
  label: string
  children: ReactNode
  error?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-label" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-caption" style={{ color: 'var(--danger)' }}>
          {error}
        </span>
      ) : null}
    </label>
  )
}

export const inputClass = 'h-9 w-full rounded-[8px] px-3 text-label outline-none'
export const inputStyle = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
} as const
