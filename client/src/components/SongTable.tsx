import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AlertTriangle, GripVertical, Minus, Plus, X } from 'lucide-react'
import type { SetlistSong } from '@shared/types.ts'
import { keyJump, soundingKey, transposeKey, semitonesFromKeys } from '@shared/transpose.ts'
import { TRANSPOSE_MAX, TRANSPOSE_MIN } from '@shared/types.ts'
import type { Setlist } from '@shared/types.ts'
import { useAppStore } from '../store/useAppStore.ts'
import { useMutations } from '../hooks/useQueries.ts'
import { useDebouncedCallback } from '../hooks/useDebouncedCallback.ts'
import { EqualizerBars, EnergyArc, KeyBadge, Btn } from './ui.tsx'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { announce } from '../lib/announce.ts'

function sounding(ss: SetlistSong) {
  return soundingKey(ss.song.key, ss.transposedKey)
}

export function SongTable({ setlistId, songs }: { setlistId: string; songs: SetlistSong[] }) {
  const activeId = useAppStore((s) => s.activeSetlistSongId)
  const setActive = useAppStore((s) => s.setActiveSetlistSongId)
  const setAddPickerOpen = useAppStore((s) => s.setAddPickerOpen)
  const playing = useAppStore((s) => s.playing)
  const { removeSong, patchSetlistSong, reorder } = useMutations()
  const qc = useQueryClient()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  )

  const persistTranspose = useDebouncedCallback(
    (ssId: string, transposedKey: string | null) => {
      patchSetlistSong.mutate({ setlistId, ssId, body: { transposedKey } })
    },
    500,
  )

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = songs.findIndex((s) => s.id === active.id)
    const newIndex = songs.findIndex((s) => s.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(songs, oldIndex, newIndex).map((row, order) => ({ ...row, order }))
    qc.setQueryData<Setlist>(['setlist', setlistId], (prev) =>
      prev ? { ...prev, songs: next } : prev,
    )
    reorder.mutate({ setlistId, orderedIds: next.map((s) => s.id) })
  }

  const moveSong = (id: string, dir: -1 | 1) => {
    const oldIndex = songs.findIndex((s) => s.id === id)
    const newIndex = oldIndex + dir
    if (oldIndex < 0 || newIndex < 0 || newIndex >= songs.length) return
    const next = arrayMove(songs, oldIndex, newIndex).map((row, order) => ({ ...row, order }))
    qc.setQueryData<Setlist>(['setlist', setlistId], (prev) =>
      prev ? { ...prev, songs: next } : prev,
    )
    reorder.mutate({ setlistId, orderedIds: next.map((s) => s.id) })
    announce(`Moved ${songs[oldIndex].song.title} to position ${newIndex + 1} of ${next.length}`)
  }

  return (
    <div className="overflow-x-auto px-4 pb-6">
      <div
        className="grid px-3 pb-3 text-label"
        style={{
          gridTemplateColumns: '24px 40px 1fr 56px 72px 36px',
          color: 'var(--text-muted)',
          minWidth: 420,
        }}
      >
        <span />
        <span>#</span>
        <span>Title</span>
        <span>Key</span>
        <span>BPM</span>
        <span />
      </div>
      <p className="px-3 pb-4 text-caption" style={{ color: 'var(--text-muted)' }}>
        Energy: slower to faster
      </p>
      {songs.length === 0 ? (
        <div className="px-3 py-12 text-center">
          <p className="text-heading">Add your first song</p>
          <p className="mt-2 text-body" style={{ color: 'var(--text-muted)' }}>
            Pull from the library to build this set.
          </p>
          <div className="mt-4 flex justify-center">
            <Btn onClick={() => setAddPickerOpen(true)}>Add song</Btn>
          </div>
        </div>
      ) : (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={songs.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          {songs.map((ss, i) => {
            const prev = songs[i - 1]
            const warn =
              prev && keyJump(sounding(prev), sounding(ss)) > 3
            return (
              <SortableRow
                key={ss.id}
                ss={ss}
                index={i}
                active={activeId === ss.id}
                playing={playing && activeId === ss.id}
                warn={Boolean(warn)}
                onSelect={() => setActive(ss.id)}
                onRemove={() => removeSong.mutate({ setlistId, ssId: ss.id })}
                onMove={(dir) => moveSong(ss.id, dir)}
                onTranspose={(delta) => {
                  const current = sounding(ss)
                  const next = transposeKey(current, delta)
                  const orig = ss.song.key
                  const stored = next === orig ? null : next
                  qc.setQueryData<Setlist>(['setlist', setlistId], (prev) => {
                    if (!prev?.songs) return prev
                    return {
                      ...prev,
                      songs: prev.songs.map((row) =>
                        row.id === ss.id ? { ...row, transposedKey: stored } : row,
                      ),
                    }
                  })
                  persistTranspose(ss.id, stored)
                }}
              />
            )
          })}
        </SortableContext>
      </DndContext>
      )}
      {songs.length > 0 ? (
      <button
        type="button"
        onClick={() => setAddPickerOpen(true)}
        className="mt-1 w-full rounded-[8px] px-3 py-3 text-left text-label"
        style={{ color: 'var(--text-secondary)' }}
      >
        Add song from the library
      </button>
      ) : null}
    </div>
  )
}

function SortableRow({
  ss,
  index,
  active,
  playing,
  warn,
  onSelect,
  onRemove,
  onMove,
  onTranspose,
}: {
  ss: SetlistSong
  index: number
  active: boolean
  playing: boolean
  warn: boolean
  onSelect: () => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
  onTranspose: (delta: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ss.id,
  })
  const [hover, setHover] = useState(false)
  const key = sounding(ss)
  const offset = ss.transposedKey ? semitonesFromKeys(ss.song.key, ss.transposedKey) : 0

  return (
    <div
      ref={setNodeRef}
      className="group relative grid items-center px-3 py-4"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        background: hover || active ? 'var(--surface-1)' : undefined,
        borderBottom: '1px solid var(--border)',
        color: 'var(--text-primary)',
        opacity: isDragging ? 0.7 : 1,
        minWidth: 420,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onSelect}
    >
      <div
        className="grid items-center"
        style={{ gridTemplateColumns: '24px 40px 1fr 56px 72px 36px' }}
      >
        <button
          type="button"
          title="Drag to reorder"
          aria-label={`Reorder ${ss.song.title}. Hold Alt and press up or down to move.`}
          className="flex h-8 w-5 shrink-0 touch-none items-center justify-center"
          style={{ color: 'var(--text-muted)', cursor: 'grab' }}
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (!e.altKey) return
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              onMove(-1)
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              onMove(1)
            }
          }}
        >
          <GripVertical size={14} />
        </button>
        <div className="relative flex h-8 items-center">
          {hover ? (
            <div
              className="flex items-center gap-0.5 text-[11px]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                aria-label="Transpose down"
                disabled={offset <= TRANSPOSE_MIN}
                onClick={() => onTranspose(-1)}
              >
                <Minus size={10} />
              </button>
              <span className="min-w-[18px] text-center font-mono tabular" style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                {key}
              </span>
              <button
                type="button"
                aria-label="Transpose up"
                disabled={offset >= TRANSPOSE_MAX}
                onClick={() => onTranspose(1)}
              >
                <Plus size={10} />
              </button>
            </div>
          ) : playing ? (
            <EqualizerBars />
          ) : (
            <span className="text-caption tabular" style={{ color: 'var(--text-secondary)' }}>
              {index + 1}
            </span>
          )}
        </div>
        <div className="min-w-0 pr-2">
          <div className="flex items-center gap-1.5 truncate text-body">
            {ss.song.title}
            {warn ? (
              <span title="Key jump greater than 3 semitones">
                <AlertTriangle size={13} style={{ color: 'var(--warning)' }} />
              </span>
            ) : null}
          </div>
          <div className="truncate text-caption" style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
            {ss.song.artist}
          </div>
        </div>
        <KeyBadge value={key} size="sm" />
        <span className="inline-flex items-center gap-1 text-caption tabular" style={{ color: 'var(--text-secondary)' }}>
          <EnergyArc bpm={ss.song.bpm} />
          {ss.song.bpm}
        </span>
        <button
          type="button"
          aria-label={`Remove ${ss.song.title}`}
          className="justify-self-end opacity-0 group-hover:opacity-100"
          style={{ color: 'var(--text-secondary)' }}
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
