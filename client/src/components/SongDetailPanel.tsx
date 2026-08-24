import { Minus, Pencil, Play, Plus } from 'lucide-react'
import type { SetlistSong, Song } from '@shared/types.ts'
import { soundingKey, transposeKey, semitonesFromKeys, preferFlatsForKey } from '@shared/transpose.ts'
import { TRANSPOSE_MAX, TRANSPOSE_MIN } from '@shared/types.ts'
import { useAppStore } from '../store/useAppStore.ts'
import { useMutations, useSong } from '../hooks/useQueries.ts'
import { useDebouncedCallback } from '../hooks/useDebouncedCallback.ts'
import { useQueryClient } from '@tanstack/react-query'
import type { Setlist } from '@shared/types.ts'
import { Btn, KeyBadge, Pill } from './ui.tsx'
import { ChordChart } from './ChordChart.tsx'
import { cn } from '../lib/cn.ts'

export function SongDetailPanel({
  setlistSong,
  songOverride,
}: {
  setlistSong?: SetlistSong | null
  songOverride?: Song | null
}) {
  const songId = songOverride?.id ?? setlistSong?.songId ?? null
  const { data: full, isLoading, isError } = useSong(songId)
  const song = full ?? songOverride ?? setlistSong?.song
  const lyricsOnly = useAppStore((s) => s.lyricsOnly)
  const setLyricsOnly = useAppStore((s) => s.setLyricsOnly)
  const openPresentation = useAppStore((s) => s.openPresentation)
  const openEditor = useAppStore((s) => s.openEditor)
  const sectionIndex = useAppStore((s) => s.activeSectionIndex)
  const setSection = useAppStore((s) => s.setActiveSectionIndex)
  const { patchSetlistSong } = useMutations()
  const setlistId = setlistSong?.setlistId
  const qc = useQueryClient()

  const persistTranspose = useDebouncedCallback(
    (transposedKey: string | null) => {
      if (!setlistSong || !setlistId) return
      patchSetlistSong.mutate({ setlistId, ssId: setlistSong.id, body: { transposedKey } })
    },
    500,
  )

  if (!song) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-[13px]" style={{ color: 'var(--text-dim)' }}>
        Select a song to see the chart
      </div>
    )
  }

  const key = setlistSong ? soundingKey(song.key, setlistSong.transposedKey) : song.key
  const offset = setlistSong?.transposedKey ? semitonesFromKeys(song.key, setlistSong.transposedKey) : 0
  const sections = [...(song.sections ?? [])].sort((a, b) => a.order - b.order)

  const shift = (delta: number) => {
    if (!setlistSong || !setlistId) return
    const next = transposeKey(key, delta)
    const stored = next === song.key ? null : next
    qc.setQueryData<Setlist>(['setlist', setlistId], (prev) => {
      if (!prev?.songs) return prev
      return {
        ...prev,
        songs: prev.songs.map((row) =>
          row.id === setlistSong.id ? { ...row, transposedKey: stored } : row,
        ),
      }
    })
    persistTranspose(stored)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-serif text-[20px] font-semibold">{song.title}</h2>
            <button type="button" onClick={() => openEditor(song.id)} style={{ color: 'var(--text-dim)' }}>
              <Pencil size={14} />
            </button>
          </div>
          <div className="text-[12px]" style={{ color: 'var(--text-dim)' }}>
            {song.artist}
          </div>
        </div>
        <Btn accent onClick={openPresentation} className="shrink-0">
          <Play size={13} fill="currentColor" /> Present
        </Btn>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 px-5">
        <Pill accent>Key of {key}</Pill>
        <Pill>{song.bpm} BPM</Pill>
        <Pill>{song.timeSignature}</Pill>
        <Pill>{song.tag}</Pill>
      </div>

      {setlistSong ? (
        <div className="mt-4 px-5">
          <div className="text-[10px] font-semibold tracking-[0.14em]" style={{ color: 'var(--text-faint)' }}>
            TRANSPOSE
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-[8px]"
              style={{ background: 'var(--card)' }}
              disabled={offset <= TRANSPOSE_MIN}
              onClick={() => shift(-1)}
            >
              <Minus size={14} />
            </button>
            <div className="min-w-[36px] text-center">
              <KeyBadge value={key} />
            </div>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-[8px]"
              style={{ background: 'var(--card)' }}
              disabled={offset >= TRANSPOSE_MAX}
              onClick={() => shift(1)}
            >
              <Plus size={14} />
            </button>
            {setlistSong.transposedKey && setlistSong.transposedKey !== song.key ? (
              <span className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
                orig: {song.key}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex px-5">
        <div className="inline-flex rounded-[20px] p-0.5" style={{ background: 'var(--card)' }}>
          {(['Chords', 'Lyrics only'] as const).map((label) => {
            const on = label === 'Lyrics only' ? lyricsOnly : !lyricsOnly
            return (
              <button
                key={label}
                type="button"
                onClick={() => setLyricsOnly(label === 'Lyrics only')}
                className={cn('rounded-[20px] px-3 py-1 text-[12px]')}
                style={{
                  background: on ? 'var(--accent)' : 'transparent',
                  color: on ? '#fff' : 'var(--text-dim)',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {sections.length > 0 ? (
        <div className="mt-3 flex gap-1.5 overflow-x-auto px-5 pb-1">
          {sections.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(i)}
              className="shrink-0 rounded-[20px] px-3 py-1 text-[12px]"
              style={{
                background: sectionIndex === i ? 'var(--accent)' : 'var(--card)',
                color: sectionIndex === i ? '#fff' : 'var(--text)',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="scrollbar-thin mt-3 flex-1 overflow-y-auto px-5 pb-6">
        {isLoading && sections.length === 0 ? (
          <div className="space-y-2">
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-16 w-full" />
            <div className="skeleton h-16 w-full" />
          </div>
        ) : isError && sections.length === 0 ? (
          <p className="text-[13px]" style={{ color: 'var(--warn)' }}>
            Could not load this chart. Check that the API is running, then refresh.
          </p>
        ) : sections.length === 0 ? (
          <p className="text-[13px]" style={{ color: 'var(--text-dim)' }}>
            No chart yet. Click the pencil to add one.
          </p>
        ) : (
          <ChordChart
            sections={sections}
            lyricsOnly={lyricsOnly}
            semitones={offset}
            preferFlats={preferFlatsForKey(key)}
            highlightSection={sectionIndex}
          />
        )}
      </div>
    </div>
  )
}
