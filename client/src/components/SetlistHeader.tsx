import { Pencil, Play, Plus } from 'lucide-react'
import type { Setlist, SetlistSong } from '@shared/types.ts'
import { formatDate } from '@shared/duration.ts'
import { soundingKey } from '@shared/transpose.ts'
import { useAppStore } from '../store/useAppStore.ts'
import { useMutations } from '../hooks/useQueries.ts'
import { useDebouncedCallback } from '../hooks/useDebouncedCallback.ts'
import { Btn, SetlistThumb } from './ui.tsx'
import { useEffect, useRef, useState } from 'react'

export function SetlistHeader({ setlist, songs }: { setlist: Setlist; songs: SetlistSong[] }) {
  const openPresentation = useAppStore((s) => s.openPresentation)
  const openSetlistModal = useAppStore((s) => s.openSetlistModal)
  const { patchSetlist } = useMutations()

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(setlist.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => setName(setlist.name), [setlist.name])

  const debouncedRename = useDebouncedCallback((next: string) => {
    if (next.trim() && next.trim() !== setlist.name) {
      patchSetlist.mutate({ id: setlist.id, body: { name: next.trim() } })
    }
  }, 1000)

  const keys = Array.from(
    new Set(songs.map((s) => soundingKey(s.song.key, s.transposedKey))),
  )

  return (
    <div className="flex gap-5 px-6 pt-5 pb-4">
      <div className="relative hidden sm:block">
        <SetlistThumb colorIndex={setlist.colorIndex} size={160} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-label" style={{ color: 'var(--text-muted)' }}>
          Setlist
        </div>
        <div className="mt-1 flex items-center gap-2">
          {editing ? (
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                debouncedRename(e.target.value)
              }}
              onBlur={() => {
                setEditing(false)
                if (name.trim() && name.trim() !== setlist.name) {
                  patchSetlist.mutate({ id: setlist.id, body: { name: name.trim() } })
                } else setName(setlist.name)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                if (e.key === 'Escape') {
                  setName(setlist.name)
                  setEditing(false)
                }
              }}
              className="font-display text-display w-full bg-transparent outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
          ) : (
            <h1
              className="font-display text-display cursor-text"
              onClick={() => {
                setEditing(true)
                setTimeout(() => inputRef.current?.select(), 0)
              }}
            >
              {setlist.name}
            </h1>
          )}
          <button
            type="button"
            aria-label="Edit setlist details"
            title="Edit details"
            onClick={() => openSetlistModal(setlist.id)}
            style={{ color: 'var(--text-secondary)' }}
          >
            <Pencil size={16} />
          </button>
        </div>
        <div className="mt-1 text-label" style={{ color: 'var(--text-secondary)' }}>
          {[setlist.serviceName, formatDate(setlist.date)].filter(Boolean).join(' · ') || 'No service details'}
        </div>
        <div className="mt-1 text-label" style={{ color: 'var(--text-secondary)' }}>
          {songs.length} {songs.length === 1 ? 'song' : 'songs'}
          {keys.length ? ` · Keys: ${keys.join(', ')}` : ''}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Btn accent onClick={openPresentation}>
            <Play size={14} fill="currentColor" /> Start presenting
          </Btn>
          <Btn onClick={() => useAppStore.getState().setAddPickerOpen(true)}>
            <Plus size={14} /> Add song
          </Btn>
        </div>
      </div>
    </div>
  )
}
