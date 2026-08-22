import { Library, Plus } from 'lucide-react'
import type { Setlist } from '@shared/types.ts'
import { formatDate } from '@shared/duration.ts'
import { cn } from '../lib/cn.ts'
import { useAppStore } from '../store/useAppStore.ts'
import { SaveStatusDot, SetlistThumb, ThemeToggle } from './ui.tsx'

export function Sidebar({
  setlists,
  songCount,
  collapsed,
  overlay,
}: {
  setlists: Setlist[]
  songCount: number
  collapsed?: boolean
  overlay?: boolean
}) {
  const activeId = useAppStore((s) => s.activeSetlistId)
  const setActive = useAppStore((s) => s.setActiveSetlistId)
  const setMainView = useAppStore((s) => s.setMainView)
  const mainView = useAppStore((s) => s.mainView)
  const openSetlistModal = useAppStore((s) => s.openSetlistModal)
  const setContextMenu = useAppStore((s) => s.setContextMenu)
  const setSidebarHover = useAppStore((s) => s.setSidebarHover)

  if (collapsed && !overlay) {
    return (
      <aside
        className="flex h-full w-16 flex-col items-center py-4"
        style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
        onMouseEnter={() => setSidebarHover(true)}
      >
        <div className="mb-4 font-serif text-[18px] font-bold" style={{ color: 'var(--accent)' }}>
          S
        </div>
        <div className="flex flex-1 flex-col gap-2">
          {setlists.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setActive(s.id)
                setMainView('setlist')
              }}
              className="rounded-[8px]"
              style={activeId === s.id ? { outline: '2px solid var(--accent)' } : undefined}
            >
              <SetlistThumb colorIndex={s.colorIndex} size={36} />
            </button>
          ))}
        </div>
        <button
          type="button"
          title="Song Library"
          onClick={() => setMainView('library')}
          style={{ color: mainView === 'library' ? 'var(--accent)' : 'var(--text-dim)' }}
        >
          <Library size={18} />
        </button>
      </aside>
    )
  }

  return (
    <aside
      className={cn(
        'flex h-full w-[260px] flex-col',
        overlay && 'absolute left-0 top-0 z-30 shadow-2xl',
      )}
      style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
      onMouseLeave={() => overlay && setSidebarHover(false)}
    >
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-serif text-[26px] font-bold leading-none" style={{ color: 'var(--accent)' }}>
              Setflow
            </div>
            <div className="mt-1 text-[11px]" style={{ color: 'var(--text-dim)' }}>
              Worship setlist builder
            </div>
          </div>
          <ThemeToggle />
        </div>
        <div className="mt-3">
          <SaveStatusDot />
        </div>
      </div>

      <div className="flex items-center justify-between px-5 pb-2">
        <span className="text-[10px] font-semibold tracking-[0.14em]" style={{ color: 'var(--text-faint)' }}>
          YOUR SETLISTS
        </span>
        <button
          type="button"
          title="New setlist"
          onClick={() => openSetlistModal('new')}
          className="flex h-6 w-6 items-center justify-center rounded-[8px]"
          style={{ background: 'var(--card)', color: 'var(--text)' }}
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-2">
        {setlists.map((s) => {
          const active = activeId === s.id && mainView === 'setlist'
          const count = s._count?.songs ?? s.songs?.length ?? 0
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setActive(s.id)
                setMainView('setlist')
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                setContextMenu({ id: s.id, x: e.clientX, y: e.clientY })
              }}
              className="mb-0.5 flex w-full items-center gap-3 rounded-[8px] px-2 py-2 text-left"
              style={{
                background: active ? 'var(--card)' : 'transparent',
                boxShadow: active ? 'inset 3px 0 0 var(--accent)' : undefined,
              }}
            >
              <SetlistThumb colorIndex={s.colorIndex} size={36} />
              <div className="min-w-0">
                <div className="truncate font-serif text-[13px]">{s.name}</div>
                <div className="truncate text-[11px]" style={{ color: 'var(--text-dim)' }}>
                  {count} {count === 1 ? 'song' : 'songs'}
                  {s.date ? ` · ${formatDate(s.date)}` : ''}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => setMainView('library')}
        className="flex items-center gap-2 px-5 py-4 text-left text-[13px]"
        style={{
          borderTop: '1px solid var(--border)',
          color: mainView === 'library' ? 'var(--accent)' : 'var(--text)',
        }}
      >
        <Library size={16} />
        Song Library · {songCount} {songCount === 1 ? 'song' : 'songs'}
      </button>
    </aside>
  )
}
