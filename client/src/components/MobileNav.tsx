import { Library, ListMusic, Music } from 'lucide-react'
import { useAppStore } from '../store/useAppStore.ts'
import { cn } from '../lib/cn.ts'

export function MobileNav() {
  const tab = useAppStore((s) => s.mobileTab)
  const setTab = useAppStore((s) => s.setMobileTab)
  const items = [
    { id: 'setlist' as const, label: 'Setlist', icon: ListMusic },
    { id: 'library' as const, label: 'Library', icon: Library },
    { id: 'song' as const, label: 'Song', icon: Music },
  ]
  return (
    <nav
      className="grid grid-cols-3 md:hidden"
      style={{
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {items.map((item) => {
        const Icon = item.icon
        const active = tab === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn('flex flex-col items-center gap-0.5 py-2 text-[11px]')}
            style={{ color: active ? 'var(--accent)' : 'var(--text-dim)' }}
          >
            <Icon size={20} />
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}
