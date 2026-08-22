import type { ReactNode } from 'react'
import { COLOR_GRADIENTS } from '@shared/types.ts'
import { cn } from '../lib/cn.ts'
import { useAppStore } from '../store/useAppStore.ts'
import { useRetrySave } from '../hooks/useQueries.ts'
import { Moon, Sun, X } from 'lucide-react'

export function KeyBadge({ value, size = 'md' }: { value: string; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 28 : 34
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-semibold"
      style={{
        width: dim,
        height: dim,
        fontSize: size === 'sm' ? 10 : 11,
        background: 'var(--accent-soft)',
        color: 'var(--accent)',
      }}
    >
      {value}
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
  const [a, b] = COLOR_GRADIENTS[Math.abs(colorIndex) % COLOR_GRADIENTS.length]
  const bar = Math.max(2, size * 0.1)
  return (
    <div
      className="relative shrink-0 overflow-hidden"
      style={{
        width: size,
        height: size,
        borderRadius: radius ?? (size > 64 ? 12 : 8),
        background: `linear-gradient(145deg, ${a} 0%, ${b} 100%)`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 30% 22%, rgba(255,255,255,0.2), transparent 55%)',
        }}
      />
      <div
        className="absolute"
        style={{
          left: '50%',
          top: '44%',
          width: bar,
          height: size * 0.48,
          background: 'rgba(255,255,255,0.32)',
          transform: 'translate(-50%, -50%)',
          borderRadius: 1,
        }}
      />
      <div
        className="absolute"
        style={{
          left: '50%',
          top: '38%',
          width: size * 0.34,
          height: bar,
          background: 'rgba(255,255,255,0.32)',
          transform: 'translate(-50%, -50%)',
          borderRadius: 1,
        }}
      />
    </div>
  )
}

export function EqualizerBars() {
  return (
    <div className="flex h-4 items-end gap-[2px]">
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
      onClick={onClick}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-[8px] transition-colors',
        className,
      )}
      style={{
        background: accent ? 'var(--accent)' : 'transparent',
        color: accent ? '#fff' : 'var(--text)',
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
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-[8px] px-3 text-[13px] font-medium transition-opacity',
        className,
      )}
      style={{
        background: accent ? 'var(--accent)' : ghost ? 'transparent' : 'var(--card)',
        color: accent ? '#fff' : 'var(--text)',
        border: ghost || accent ? 'none' : '1px solid var(--border)',
      }}
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
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-[20px] px-3 py-1 text-[12px] font-medium"
      style={{
        background: active || accent ? 'var(--accent)' : 'var(--card)',
        color: active || accent ? '#fff' : 'var(--text)',
        border: active || accent ? 'none' : '1px solid var(--border)',
      }}
    >
      {children}
    </button>
  )
}

export function ThemeToggle() {
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  return (
    <button
      type="button"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="inline-flex h-8 w-8 items-center justify-center rounded-[8px]"
      style={{ color: 'var(--text-dim)' }}
      title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}

export function SaveStatusDot() {
  const status = useAppStore((s) => s.saveStatus)
  const retry = useRetrySave()
  const color = status === 'saving' ? 'var(--accent)' : status === 'failed' ? 'var(--danger)' : 'var(--text-faint)'
  return (
    <button
      type="button"
      title={status === 'failed' ? 'Save failed — click to retry' : status === 'saving' ? 'Saving' : 'Saved'}
      onClick={() => status === 'failed' && void retry()}
      className="inline-flex items-center gap-1.5 text-[11px]"
      style={{ color: 'var(--text-dim)' }}
    >
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      {status === 'saving' ? 'Saving' : status === 'failed' ? 'Retry' : 'Saved'}
    </button>
  )
}

export function OfflineBanner() {
  const offline = useAppStore((s) => s.offline)
  if (!offline) return null
  return (
    <div
      className="z-40 px-4 py-2 text-center text-[13px]"
      style={{ background: 'var(--warn)', color: '#1c1612' }}
    >
      Working offline — changes won't be saved
    </div>
  )
}

export function ConfirmDialog() {
  const confirm = useAppStore((s) => s.confirm)
  const close = useAppStore((s) => s.closeConfirm)
  if (!confirm) return null
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div
        className="w-full max-w-sm rounded-[12px] p-5"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="mb-2 flex items-start justify-between">
          <h3 className="text-[16px] font-semibold">{confirm.title}</h3>
          <button type="button" onClick={close} style={{ color: 'var(--text-dim)' }}>
            <X size={16} />
          </button>
        </div>
        <p className="mb-5 text-[13px]" style={{ color: 'var(--text-dim)' }}>
          {confirm.message}
        </p>
        <div className="flex justify-end gap-2">
          <Btn ghost onClick={close}>
            Cancel
          </Btn>
          <Btn
            accent={!confirm.danger}
            onClick={() => {
              confirm.onConfirm()
              close()
            }}
            className={confirm.danger ? undefined : undefined}
          >
            <span style={confirm.danger ? { background: 'var(--danger)', color: '#fff', borderRadius: 8, padding: '0 4px' } : undefined}>
              {confirm.confirmLabel || 'Confirm'}
            </span>
          </Btn>
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
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>
        {label}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-[11px]" style={{ color: 'var(--danger)' }}>
          {error}
        </span>
      ) : null}
    </label>
  )
}

export const inputClass =
  'h-9 w-full rounded-[6px] px-3 text-[13px] outline-none'
export const inputStyle = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
} as const
