import { Check, ChevronRight, X } from 'lucide-react'
import { useAppStore } from '../store/useAppStore.ts'
import { useMutations } from '../hooks/useQueries.ts'
import { useOnboarding, type OnboardingStep } from '../hooks/useOnboarding.ts'

/** A dismissible getting-started checklist, shown above the setlist. */
export function OnboardingPanel() {
  const { steps, complete, total, allDone, show } = useOnboarding()
  const { patchPrefs } = useMutations()
  const store = useAppStore()

  if (!show) return null

  const dismiss = () => patchPrefs.mutate({ onboardingDone: true })

  const run = (id: OnboardingStep['id']) => {
    if (id === 'songs') store.setMainView('library')
    if (id === 'setlist') store.setMainView('setlist')
    if (id === 'team') store.openSettingsPage()
    if (id === 'background') store.openPresentation()
  }

  return (
    <section
      className="mx-4 mb-3 rounded-[12px] px-4 py-3"
      style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
      aria-label="Getting started"
    >
      <header className="flex items-center justify-between gap-3">
        <div>
          <div className="text-label" style={{ color: 'var(--text-primary)' }}>
            {allDone ? 'You are all set' : 'Getting started'}
          </div>
          <div className="text-caption" style={{ color: 'var(--text-muted)' }}>
            {allDone ? 'Nothing left to do — close this whenever you like.' : `${complete} of ${total} done`}
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss getting started"
          title="Dismiss"
          style={{ color: 'var(--text-secondary)' }}
        >
          <X size={16} />
        </button>
      </header>

      <div
        className="mt-2 h-1 w-full overflow-hidden rounded-full"
        style={{ background: 'var(--surface-2)' }}
        role="progressbar"
        aria-valuenow={complete}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${total ? (complete / total) * 100 : 0}%`, background: 'var(--accent)' }}
        />
      </div>

      <ul className="mt-3 flex flex-col gap-1">
        {steps.map((step) => (
          <li key={step.id}>
            <button
              type="button"
              onClick={() => run(step.id)}
              disabled={step.done}
              className="flex w-full items-center gap-3 rounded-[8px] px-2 py-2 text-left"
              style={{ opacity: step.done ? 0.6 : 1 }}
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: step.done ? 'var(--accent)' : 'transparent',
                  border: step.done ? 'none' : '1.5px solid var(--border-strong)',
                  color: 'var(--canvas)',
                }}
              >
                {step.done ? <Check size={12} /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className="block text-label"
                  style={{
                    color: 'var(--text-primary)',
                    textDecoration: step.done ? 'line-through' : undefined,
                  }}
                >
                  {step.title}
                </span>
                <span className="block text-caption" style={{ color: 'var(--text-muted)' }}>
                  {step.blurb}
                </span>
              </span>
              {step.done ? null : (
                <span className="inline-flex shrink-0 items-center gap-1 text-caption" style={{ color: 'var(--accent)' }}>
                  {step.action}
                  <ChevronRight size={12} />
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
