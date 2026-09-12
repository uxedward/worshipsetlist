import { useEffect, useMemo, useState } from 'react'
import { Check, Plus, Search, X } from 'lucide-react'
import type { Song } from '@shared/types.ts'
import { useAppStore } from '../store/useAppStore.ts'
import { useMutations, useSetlist, useSongs } from '../hooks/useQueries.ts'
import { Btn, KeyBadge } from './ui.tsx'

export function AddSongPicker() {
  const open = useAppStore((s) => s.addPickerOpen)
  const close = () => useAppStore.getState().setAddPickerOpen(false)
  const setlistId = useAppStore((s) => s.activeSetlistId)
  const { data: setlist } = useSetlist(open ? setlistId : null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { data: songs = [], isLoading } = useSongs({ search, sort: 'title' }, open)
  const { addSong } = useMutations()

  const inSetlist = useMemo(
    () => new Set((setlist?.songs ?? []).map((s) => s.songId)),
    [setlist?.songs],
  )

  useEffect(() => {
    if (!open) return
    setError(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  const add = (song: Song) => {
    if (!setlistId) {
      setError('Select a setlist first.')
      return
    }
    if (inSetlist.has(song.id)) return
    setError(null)
    addSong.mutate(
      { setlistId, songId: song.id },
      {
        onError: (err) => {
          setError(err instanceof Error ? err.message : 'Could not add that song.')
        },
      },
    )
  }

  return (
    <div
      className="fixed inset-0 z-[72] flex items-center justify-center p-4"
      style={{ background: 'var(--present-scrim)' }}
      onClick={close}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-[12px] p-5"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-title">Add songs</h3>
            <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
              {setlist?.name ?? 'No setlist selected'}
            </p>
          </div>
          <button type="button" onClick={close} aria-label="Close" style={{ color: 'var(--text-secondary)' }}>
            <X size={16} />
          </button>
        </div>
        <div
          className="flex h-10 items-center gap-2 rounded-[8px] px-3"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
        >
          <Search size={16} style={{ color: 'var(--text-secondary)' }} />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or artist"
            className="h-full w-full bg-transparent text-[13px] outline-none"
          />
        </div>
        {error ? (
          <div className="mt-2 text-[12px]" style={{ color: 'var(--warning)' }}>
            {error}
          </div>
        ) : null}
        <div className="scrollbar-thin mt-3 min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton h-12" />
              ))}
            </div>
          ) : songs.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-heading">Add your first song</p>
              <p className="mt-2 text-body" style={{ color: 'var(--text-muted)' }}>
                Open the library to import a playlist or create a chart.
              </p>
            </div>
          ) : (
            songs.map((song) => {
              const added = inSetlist.has(song.id)
              return (
                <div key={song.id} className="flex items-center gap-3 rounded-[8px] px-2 py-2">
                  <KeyBadge value={song.key} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px]">{song.title}</div>
                    <div className="truncate text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                      {song.artist}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={added || !setlistId}
                    onClick={() => add(song)}
                    className="flex h-8 items-center gap-1 rounded-[8px] px-2 text-caption"
                    style={{
                      background: 'transparent',
                      color: added ? 'var(--text-secondary)' : 'var(--text-primary)',
                      border: added ? '0' : '1px solid var(--border-strong)',
                    }}
                  >
                    {added ? (
                      <>
                        <Check size={12} /> Added
                      </>
                    ) : (
                      <>
                        <Plus size={12} /> Add
                      </>
                    )}
                  </button>
                </div>
              )
            })
          )}
        </div>
        <div className="mt-3 flex justify-end">
          <Btn ghost onClick={close}>
            Done
          </Btn>
        </div>
      </div>
    </div>
  )
}
