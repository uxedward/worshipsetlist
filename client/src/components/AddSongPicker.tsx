import { useEffect, useMemo, useState } from 'react'
import { Check, Plus, Search, X } from 'lucide-react'
import type { Setlist, SetlistSong, Song } from '@shared/types.ts'
import { useAppStore } from '../store/useAppStore.ts'
import { useMutations, useSetlist, useSongs } from '../hooks/useQueries.ts'
import { Btn, KeyBadge } from './ui.tsx'
import { useQueryClient } from '@tanstack/react-query'

export function AddSongPicker() {
  const open = useAppStore((s) => s.addPickerOpen)
  const close = () => useAppStore.getState().setAddPickerOpen(false)
  const setlistId = useAppStore((s) => s.activeSetlistId)
  const { data: setlist } = useSetlist(setlistId)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [addingId, setAddingId] = useState<string | null>(null)
  const { data: songs = [], isLoading } = useSongs({ search, sort: 'title' })
  const { addSong } = useMutations()
  const qc = useQueryClient()

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
    setAddingId(song.id)
    addSong.mutate(
      { setlistId, songId: song.id },
      {
        onSuccess: (row) => {
          qc.setQueryData<Setlist>(['setlist', setlistId], (prev) => {
            if (!prev) return prev
            const songsOnList = prev.songs ?? []
            if (songsOnList.some((s) => s.id === row.id || s.songId === song.id)) return prev
            return { ...prev, songs: [...songsOnList, row as SetlistSong] }
          })
          void qc.invalidateQueries({ queryKey: ['setlists'] })
          setAddingId(null)
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : 'Could not add that song.')
          setAddingId(null)
        },
      },
    )
  }

  return (
    <div
      className="fixed inset-0 z-[72] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={close}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-[12px] p-5"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="font-serif text-[20px]">Add songs</h3>
            <p className="text-[12px]" style={{ color: 'var(--text-dim)' }}>
              {setlist?.name ?? 'No setlist selected'}
            </p>
          </div>
          <button type="button" onClick={close} style={{ color: 'var(--text-dim)' }}>
            <X size={16} />
          </button>
        </div>
        <div
          className="flex h-10 items-center gap-2 rounded-[8px] px-3"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <Search size={16} style={{ color: 'var(--text-dim)' }} />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or artist"
            className="h-full w-full bg-transparent text-[13px] outline-none"
          />
        </div>
        {error ? (
          <div className="mt-2 text-[12px]" style={{ color: 'var(--warn)' }}>
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
            <div className="py-10 text-center text-[13px]" style={{ color: 'var(--text-dim)' }}>
              No songs in the library yet.
            </div>
          ) : (
            songs.map((song) => {
              const added = inSetlist.has(song.id)
              return (
                <div key={song.id} className="flex items-center gap-3 rounded-[8px] px-2 py-2">
                  <KeyBadge value={song.key} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px]">{song.title}</div>
                    <div className="truncate text-[11px]" style={{ color: 'var(--text-dim)' }}>
                      {song.artist}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={added || addingId === song.id || !setlistId}
                    onClick={() => add(song)}
                    className="flex h-8 items-center gap-1 rounded-[8px] px-2 text-[12px]"
                    style={{
                      background: added ? 'transparent' : 'var(--accent)',
                      color: added ? 'var(--text-dim)' : '#fff',
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
