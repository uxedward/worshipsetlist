import { Check, Copy, Download, MoreHorizontal, Pencil, Play, Plus } from 'lucide-react'
import type { Setlist, SetlistSong } from '@shared/types.ts'
import { formatDate, formatDurationLong } from '@shared/duration.ts'
import { soundingKey } from '@shared/transpose.ts'
import { useAppStore } from '../store/useAppStore.ts'
import { useMutations } from '../hooks/useQueries.ts'
import { useDebouncedCallback } from '../hooks/useDebouncedCallback.ts'
import { Btn, SetlistThumb } from './ui.tsx'
import { useEffect, useRef, useState } from 'react'

export function SetlistHeader({ setlist, songs }: { setlist: Setlist; songs: SetlistSong[] }) {
  const openPresentation = useAppStore((s) => s.openPresentation)
  const openSetlistModal = useAppStore((s) => s.openSetlistModal)
  const setExportOpen = useAppStore((s) => s.setExportOpen)
  const saveStatus = useAppStore((s) => s.saveStatus)
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
  const total = songs.reduce((sum, s) => sum + (s.song.durationSeconds ?? 0), 0)

  const copyPlain = async () => {
    const { buildSetlistPlain } = await import('../lib/pdf.ts')
    await navigator.clipboard.writeText(buildSetlistPlain(songs))
  }

  return (
    <div className="flex gap-5 px-6 pt-5 pb-4">
      <div className="relative hidden sm:block">
        <SetlistThumb colorIndex={setlist.colorIndex} size={160} radius={12} />
        <div
          className="absolute bottom-2 left-2 flex items-center gap-1 rounded-[20px] px-2 py-0.5 text-[10px]"
          style={{ background: 'rgba(0,0,0,0.45)', color: '#fff' }}
        >
          <Check size={10} />
          {saveStatus === 'saving' ? 'Saving' : saveStatus === 'failed' ? 'Failed' : 'Saved'}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold tracking-[0.16em]" style={{ color: 'var(--text-faint)' }}>
          SETLIST
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
              className="w-full bg-transparent font-serif text-[32px] font-bold outline-none md:text-[42px]"
              style={{ color: 'var(--text)' }}
            />
          ) : (
            <h1
              className="cursor-text font-serif text-[32px] font-bold leading-tight md:text-[42px]"
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
            title="Edit details"
            onClick={() => openSetlistModal(setlist.id)}
            style={{ color: 'var(--text-dim)' }}
          >
            <Pencil size={16} />
          </button>
        </div>
        <div className="mt-1 text-[13px]" style={{ color: 'var(--text-dim)' }}>
          {[setlist.serviceName, formatDate(setlist.date)].filter(Boolean).join(' · ') || 'No service details'}
        </div>
        <div className="mt-1 text-[13px]" style={{ color: 'var(--text-dim)' }}>
          {songs.length} {songs.length === 1 ? 'song' : 'songs'} · {formatDurationLong(total)}
          {keys.length ? ` · Keys: ${keys.join(', ')}` : ''}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Btn accent onClick={openPresentation}>
            <Play size={14} fill="currentColor" /> Present
          </Btn>
          <Btn ghost onClick={() => useAppStore.getState().setMainView('library')}>
            <Plus size={14} /> Add Song
          </Btn>
          <Btn ghost onClick={() => void copyPlain()}>
            <Copy size={14} /> Copy
          </Btn>
          <Btn ghost onClick={() => setExportOpen(true)}>
            <Download size={14} /> Export
          </Btn>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-[8px]"
            style={{ color: 'var(--text-dim)' }}
            onClick={() => openSetlistModal(setlist.id)}
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
