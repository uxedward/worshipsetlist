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
import { AlertTriangle, GripVertical, Minus, Plus, X } from 'lucide-react'
import type { SetlistSong } from '@shared/types.ts'
import { formatDuration } from '@shared/duration.ts'
import { keyJump, soundingKey, transposeKey, semitonesFromKeys } from '@shared/transpose.ts'
import { TRANSPOSE_MAX, TRANSPOSE_MIN } from '@shared/types.ts'
import type { Setlist } from '@shared/types.ts'
import { cn } from '../lib/cn.ts'
import { useAppStore } from '../store/useAppStore.ts'
import { useMutations } from '../hooks/useQueries.ts'
import { useDebouncedCallback } from '../hooks/useDebouncedCallback.ts'
import { EqualizerBars, KeyBadge } from './ui.tsx'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const persistReorder = useDebouncedCallback((ids: string[]) => {
    reorder.mutate({ setlistId, orderedIds: ids })
  }, 800)

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
    const next = arrayMove(songs, oldIndex, newIndex)
    qc.setQueryData<Setlist>(['setlist', setlistId], (prev) =>
      prev ? { ...prev, songs: next } : prev,
    )
    persistReorder(next.map((s) => s.id))
  }

  return (
    <div className="overflow-x-auto px-4 pb-6">
      <div
        className="grid px-3 pb-2 text-[10px] font-semibold tracking-[0.12em]"
        style={{
          gridTemplateColumns: '40px 1fr 56px 48px 88px 48px 36px',
          color: 'var(--text-faint)',
          minWidth: 560,
        }}
      >
        <span>#</span>
        <span>TITLE</span>
        <span>KEY</span>
        <span>BPM</span>
        <span>TAG</span>
        <span>⏱</span>
        <span />
      </div>
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
      <button
        type="button"
        onClick={() => setAddPickerOpen(true)}
        className="mt-1 w-full rounded-[8px] px-3 py-3 text-left text-[13px]"
        style={{ color: 'var(--text-dim)' }}
      >
        + Add a song from the library
      </button>
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
  onTranspose,
}: {
  ss: SetlistSong
  index: number
  active: boolean
  playing: boolean
  warn: boolean
  onSelect: () => void
  onRemove: () => void
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
      className="group relative grid items-center rounded-[8px] px-3"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        height: 48,
        background: active ? 'var(--card)' : undefined,
        boxShadow: active ? 'inset 3px 0 0 var(--accent)' : undefined,
        color: active ? 'var(--accent)' : 'var(--text)',
        opacity: isDragging ? 0.7 : 1,
        minWidth: 560,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onSelect}
    >
      <div
        className="grid items-center"
        style={{ gridTemplateColumns: '40px 1fr 56px 48px 88px 48px 36px' }}
      >
        <div className="relative flex h-8 items-center">
          <button
            type="button"
            className={cn(
              'absolute -left-5 text-[var(--text-faint)] opacity-0 group-hover:opacity-100',
            )}
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={14} />
          </button>
          {hover ? (
            <div
              className="flex items-center gap-0.5 text-[11px]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                disabled={offset <= TRANSPOSE_MIN}
                onClick={() => onTranspose(-1)}
              >
                <Minus size={10} />
              </button>
              <span className="min-w-[18px] text-center font-medium">{key}</span>
              <button
                type="button"
                disabled={offset >= TRANSPOSE_MAX}
                onClick={() => onTranspose(1)}
              >
                <Plus size={10} />
              </button>
            </div>
          ) : playing ? (
            <EqualizerBars />
          ) : (
            <span className="text-[12px]" style={{ color: 'var(--text-dim)' }}>
              {index + 1}
            </span>
          )}
        </div>
        <div className="min-w-0 pr-2">
          <div className="flex items-center gap-1.5 truncate text-[14px]">
            {ss.song.title}
            {warn ? (
              <span title="Key jump greater than 3 semitones">
                <AlertTriangle size={13} style={{ color: 'var(--warn)' }} />
              </span>
            ) : null}
          </div>
          <div className="truncate text-[11px]" style={{ color: 'var(--text-dim)' }}>
            {ss.song.artist}
          </div>
        </div>
        <KeyBadge value={key} size="sm" />
        <span className="text-[12px]" style={{ color: 'var(--text-dim)' }}>
          {ss.song.bpm}
        </span>
        <span
          className="w-fit rounded-[20px] px-2 py-0.5 text-[10px]"
          style={{ background: 'var(--card)', color: 'var(--text-dim)' }}
        >
          {ss.song.tag}
        </span>
        <span className="text-[12px]" style={{ color: 'var(--text-dim)' }}>
          {formatDuration(ss.song.durationSeconds)}
        </span>
        <button
          type="button"
          className="justify-self-end opacity-0 group-hover:opacity-100"
          style={{ color: 'var(--text-dim)' }}
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
