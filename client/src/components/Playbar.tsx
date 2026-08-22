import {
  Copy,
  Download,
  Minus,
  Pause,
  Play,
  Plus,
  Presentation,
  SkipBack,
  SkipForward,
} from 'lucide-react'
import type { Setlist, SetlistSong } from '@shared/types.ts'
import { formatDuration } from '@shared/duration.ts'
import { soundingKey, transposeKey, semitonesFromKeys } from '@shared/transpose.ts'
import { TRANSPOSE_MAX, TRANSPOSE_MIN } from '@shared/types.ts'
import { useAppStore } from '../store/useAppStore.ts'
import { useMutations } from '../hooks/useQueries.ts'
import { useDebouncedCallback } from '../hooks/useDebouncedCallback.ts'
import { KeyBadge, SetlistThumb } from './ui.tsx'
import { buildSetlistPlain } from '../lib/pdf.ts'

export function Playbar({ setlist, songs }: { setlist?: Setlist; songs: SetlistSong[] }) {
  const activeId = useAppStore((s) => s.activeSetlistSongId)
  const setActive = useAppStore((s) => s.setActiveSetlistSongId)
  const playing = useAppStore((s) => s.playing)
  const setPlaying = useAppStore((s) => s.setPlaying)
  const elapsed = useAppStore((s) => s.elapsed)
  const setElapsed = useAppStore((s) => s.setElapsed)
  const openPresentation = useAppStore((s) => s.openPresentation)
  const setExportOpen = useAppStore((s) => s.setExportOpen)
  const { patchSetlistSong } = useMutations()

  const index = Math.max(0, songs.findIndex((s) => s.id === activeId))
  const current = songs[index] ?? songs[0]
  const duration = current?.song.durationSeconds ?? 0
  const progress = duration > 0 ? Math.min(1, elapsed / duration) : 0
  const key = current ? soundingKey(current.song.key, current.transposedKey) : ''
  const offset = current?.transposedKey ? semitonesFromKeys(current.song.key, current.transposedKey) : 0

  const persistTranspose = useDebouncedCallback(
    (ssId: string, transposedKey: string | null) => {
      if (!setlist) return
      patchSetlistSong.mutate({ setlistId: setlist.id, ssId, body: { transposedKey } })
    },
    500,
  )

  const go = (dir: number) => {
    if (songs.length === 0) return
    const next = (index + dir + songs.length) % songs.length
    setActive(songs[next].id)
    setElapsed(0)
  }

  if (!current) {
    return (
      <div
        className="hidden h-[72px] items-center px-4 md:flex"
        style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}
      >
        <span className="text-[12px]" style={{ color: 'var(--text-dim)' }}>
          Add songs to start rehearsing
        </span>
      </div>
    )
  }

  return (
    <div
      className="hidden h-[72px] items-center gap-4 px-4 md:flex"
      style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}
    >
      <div className="flex min-w-[220px] items-center gap-3">
        <SetlistThumb colorIndex={setlist?.colorIndex ?? 0} size={48} radius={8} />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium">{current.song.title}</div>
          <div className="truncate text-[11px]" style={{ color: 'var(--text-dim)' }}>
            {current.song.artist}
          </div>
        </div>
        <KeyBadge value={key} size="sm" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col items-center">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => go(-1)} style={{ color: 'var(--text)' }}>
            <SkipBack size={18} />
          </button>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ background: 'var(--accent)', color: '#fff' }}
            onClick={() => setPlaying(!playing)}
          >
            {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
          </button>
          <button type="button" onClick={() => go(1)} style={{ color: 'var(--text)' }}>
            <SkipForward size={18} />
          </button>
        </div>
        <div className="mt-1 flex w-full max-w-md items-center gap-2 text-[10px]" style={{ color: 'var(--text-dim)' }}>
          <span>{formatDuration(elapsed)}</span>
          <div className="relative h-1 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--card)' }}>
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${progress * 100}%`, background: 'var(--accent)' }}
            />
          </div>
          <span>{formatDuration(duration)}</span>
          <span className="ml-2">
            Song {index + 1} of {songs.length}
          </span>
        </div>
      </div>

      <div className="flex min-w-[220px] items-center justify-end gap-3">
        <span className="text-[12px]" style={{ color: 'var(--text-dim)' }}>
          {current.song.bpm} BPM
        </span>
        <div className="flex items-center gap-1 text-[12px]">
          <button
            type="button"
            disabled={offset <= TRANSPOSE_MIN}
            onClick={() => {
              const next = transposeKey(key, -1)
              persistTranspose(current.id, next === current.song.key ? null : next)
            }}
          >
            <Minus size={12} />
          </button>
          <span>{key}</span>
          <button
            type="button"
            disabled={offset >= TRANSPOSE_MAX}
            onClick={() => {
              const next = transposeKey(key, 1)
              persistTranspose(current.id, next === current.song.key ? null : next)
            }}
          >
            <Plus size={12} />
          </button>
        </div>
        <button type="button" title="Present" onClick={openPresentation} style={{ color: 'var(--text)' }}>
          <Presentation size={16} />
        </button>
        <button
          type="button"
          title="Copy"
          onClick={() => void navigator.clipboard.writeText(buildSetlistPlain(songs))}
          style={{ color: 'var(--text)' }}
        >
          <Copy size={16} />
        </button>
        <button type="button" title="Export" onClick={() => setExportOpen(true)} style={{ color: 'var(--text)' }}>
          <Download size={16} />
        </button>
      </div>
    </div>
  )
}

export function MiniPlayer({ songs }: { setlist?: Setlist; songs: SetlistSong[] }) {
  const activeId = useAppStore((s) => s.activeSetlistSongId)
  const setActive = useAppStore((s) => s.setActiveSetlistSongId)
  const playing = useAppStore((s) => s.playing)
  const setPlaying = useAppStore((s) => s.setPlaying)
  const elapsed = useAppStore((s) => s.elapsed)
  const setElapsed = useAppStore((s) => s.setElapsed)

  const index = Math.max(0, songs.findIndex((s) => s.id === activeId))
  const current = songs[index] ?? songs[0]
  if (!current) return null
  const duration = current.song.durationSeconds ?? 0
  const progress = duration > 0 ? Math.min(1, elapsed / duration) : 0

  return (
    <div className="px-3 pb-1 pt-2 md:hidden" style={{ background: 'var(--surface)' }}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full"
          style={{ background: 'var(--accent)', color: '#fff' }}
          onClick={() => setPlaying(!playing)}
        >
          {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px]">{current.song.title}</div>
          <div className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
            {index + 1} of {songs.length} · {formatDuration(elapsed)} / {formatDuration(duration)}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (songs.length === 0) return
            const next = (index + 1) % songs.length
            setActive(songs[next].id)
            setElapsed(0)
          }}
        >
          <SkipForward size={18} />
        </button>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full" style={{ background: 'var(--card)' }}>
        <div className="h-full" style={{ width: `${progress * 100}%`, background: 'var(--accent)' }} />
      </div>
    </div>
  )
}
