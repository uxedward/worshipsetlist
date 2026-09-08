import { GripVertical, Library, MoreHorizontal, Plus } from 'lucide-react'
import type { Setlist } from '@shared/types.ts'
import { formatDate } from '@shared/duration.ts'
import { cn } from '../lib/cn.ts'
import { useAppStore } from '../store/useAppStore.ts'
import { SaveStatusDot, SetlistThumb, ThemeToggle } from './ui.tsx'
import { useMutations } from '../hooks/useQueries.ts'
import { useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useDebouncedCallback } from '../hooks/useDebouncedCallback.ts'

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
  const { reorderSetlists } = useMutations()
  const qc = useQueryClient()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const persistReorder = useDebouncedCallback((ids: string[]) => {
    reorderSetlists.mutate(ids)
  }, 400)

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = setlists.findIndex((s) => s.id === active.id)
    const newIndex = setlists.findIndex((s) => s.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(setlists, oldIndex, newIndex).map((s, sortOrder) => ({ ...s, sortOrder }))
    qc.setQueryData<Setlist[]>(['setlists'], next)
    persistReorder(next.map((s) => s.id))
  }

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
              onContextMenu={(e) => {
                e.preventDefault()
                setContextMenu({ id: s.id, x: e.clientX, y: e.clientY })
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={setlists.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            {setlists.map((s) => (
              <SortableSetlistRow
                key={s.id}
                setlist={s}
                active={activeId === s.id && mainView === 'setlist'}
                onOpen={() => {
                  setActive(s.id)
                  setMainView('setlist')
                }}
                onMenu={(x, y) => setContextMenu({ id: s.id, x, y })}
              />
            ))}
          </SortableContext>
        </DndContext>
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

function SortableSetlistRow({
  setlist,
  active,
  onOpen,
  onMenu,
}: {
  setlist: Setlist
  active: boolean
  onOpen: () => void
  onMenu: (x: number, y: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: setlist.id,
  })
  const count = setlist._count?.songs ?? setlist.songs?.length ?? 0

  return (
    <div
      ref={setNodeRef}
      className="group mb-0.5 flex w-full items-center gap-1 rounded-[8px] px-1 py-1"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        background: active ? 'var(--card)' : 'transparent',
        boxShadow: active ? 'inset 3px 0 0 var(--accent)' : undefined,
        opacity: isDragging ? 0.7 : 1,
      }}
    >
      <button
        type="button"
        className="flex h-8 w-5 shrink-0 items-center justify-center rounded-[6px] opacity-0 group-hover:opacity-100"
        style={{ color: 'var(--text-faint)' }}
        title="Drag to reorder"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={14} />
      </button>
      <button
        type="button"
        onClick={onOpen}
        onContextMenu={(e) => {
          e.preventDefault()
          onMenu(e.clientX, e.clientY)
        }}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-[8px] px-1 py-1 text-left"
      >
        <SetlistThumb colorIndex={setlist.colorIndex} size={36} />
        <div className="min-w-0">
          <div className="truncate font-serif text-[13px]">{setlist.name}</div>
          <div className="truncate text-[11px]" style={{ color: 'var(--text-dim)' }}>
            {count} {count === 1 ? 'song' : 'songs'}
            {setlist.date ? ` · ${formatDate(setlist.date)}` : ''}
          </div>
        </div>
      </button>
      <button
        type="button"
        title="Setlist actions"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] opacity-70 hover:opacity-100"
        style={{ color: 'var(--text-dim)' }}
        onClick={(e) => {
          e.stopPropagation()
          const rect = e.currentTarget.getBoundingClientRect()
          onMenu(rect.right, rect.top)
        }}
      >
        <MoreHorizontal size={16} />
      </button>
    </div>
  )
}
