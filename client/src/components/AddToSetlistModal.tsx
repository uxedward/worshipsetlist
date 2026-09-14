import { useEffect, useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { formatDate } from '@shared/duration.ts'
import type { Setlist, Song } from '@shared/types.ts'
import { useAppStore } from '../store/useAppStore.ts'
import { useMutations, useSetlist, useSetlists } from '../hooks/useQueries.ts'
import { Btn, SetlistThumb, Spinner } from './ui.tsx'

export function AddToSetlistModal({
  song,
  onClose,
  onBusy,
}: {
  song: Song
  onClose: () => void
  onBusy?: (busy: boolean) => void
}) {
  const { data: setlists = [], isLoading } = useSetlists()
  const openSetlistModal = useAppStore((s) => s.openSetlistModal)
  const activeId = useAppStore((s) => s.activeSetlistId)
  const { addSong } = useMutations()
  const [addingId, setAddingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !addingId) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [addingId, onClose])

  const pick = (setlist: Setlist) => {
    if (addingId) return
    setError(null)
    setAddingId(setlist.id)
    onBusy?.(true)
    const started = Date.now()
    addSong.mutate(
      { setlistId: setlist.id, songId: song.id },
      {
        onError: (err) => {
          setError(err instanceof Error ? err.message : 'Could not add that song.')
          setAddingId(null)
          onBusy?.(false)
        },
        onSuccess: () => {
          const wait = Math.max(0, 400 - (Date.now() - started))
          window.setTimeout(() => {
            onBusy?.(false)
            onClose()
          }, wait)
        },
      },
    )
  }

  return (
    <div
      className="fixed inset-0 z-[73] flex items-center justify-center p-4"
      style={{ background: 'var(--present-scrim)' }}
      onClick={() => {
        if (!addingId) onClose()
      }}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-[12px] p-5"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-title">Add to a setlist</h3>
            <p className="mt-1 truncate text-[13px]" style={{ color: 'var(--text-secondary)' }}>
              {song.title}
              {song.artist ? ` · ${song.artist}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={Boolean(addingId)}
            aria-label="Close"
            style={{ color: 'var(--text-secondary)' }}
          >
            <X size={16} />
          </button>
        </div>
        {error ? (
          <div className="mt-2 text-[12px]" style={{ color: 'var(--warning)' }}>
            {error}
          </div>
        ) : null}
        <div className="scrollbar-thin mt-3 min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton h-14" />
              ))}
            </div>
          ) : setlists.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-heading">No setlists yet</p>
              <p className="mt-2 text-body" style={{ color: 'var(--text-muted)' }}>
                Create a setlist, then add this song to it.
              </p>
              <div className="mt-4 flex justify-center">
                <Btn
                  accent
                  onClick={() => {
                    openSetlistModal('new')
                  }}
                >
                  <Plus size={14} /> New setlist
                </Btn>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {setlists.map((setlist) => (
                <SetlistChoice
                  key={setlist.id}
                  setlist={setlist}
                  songId={song.id}
                  current={setlist.id === activeId}
                  busy={addingId === setlist.id}
                  disabled={Boolean(addingId) && addingId !== setlist.id}
                  onPick={() => pick(setlist)}
                />
              ))}
            </div>
          )}
        </div>
        <div className="mt-3 flex justify-end">
          <Btn ghost disabled={Boolean(addingId)} onClick={onClose}>
            Cancel
          </Btn>
        </div>
      </div>
    </div>
  )
}

function SetlistChoice({
  setlist,
  songId,
  current,
  busy,
  disabled,
  onPick,
}: {
  setlist: Setlist
  songId: string
  current: boolean
  busy: boolean
  disabled: boolean
  onPick: () => void
}) {
  const { data: detail } = useSetlist(setlist.id)
  const songs = detail?.songs ?? setlist.songs ?? []
  const already = songs.some((row) => row.songId === songId)
  const count = detail?._count?.songs ?? detail?.songs?.length ?? setlist._count?.songs ?? setlist.songs?.length ?? 0

  return (
    <button
      type="button"
      disabled={disabled || already || busy}
      aria-busy={busy || undefined}
      onClick={onPick}
      className="flex w-full items-center gap-3 rounded-[10px] px-2 py-2 text-left"
      style={{
        background: current ? 'var(--accent-bg)' : 'transparent',
        color: already ? 'var(--text-secondary)' : 'var(--text-primary)',
        border: current ? '1px solid var(--accent-border)' : '1px solid transparent',
      }}
    >
      <SetlistThumb colorIndex={setlist.colorIndex} size={40} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-label">{setlist.name}</div>
        <div className="truncate text-caption" style={{ color: 'var(--text-secondary)' }}>
          {count} {count === 1 ? 'song' : 'songs'}
          {setlist.date ? ` · ${formatDate(setlist.date)}` : ''}
          {current ? ' · Current' : ''}
        </div>
      </div>
      {busy ? (
        <span className="flex shrink-0 items-center gap-1 text-caption">
          <Spinner size={12} /> Adding
        </span>
      ) : already ? (
        <span className="flex shrink-0 items-center gap-1 text-caption">
          <Check size={12} /> Added
        </span>
      ) : (
        <Plus size={14} className="shrink-0" style={{ color: 'var(--text-secondary)' }} />
      )}
    </button>
  )
}
