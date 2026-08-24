import { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Check, Pencil, Plus, Search } from 'lucide-react'
import { TAGS } from '@shared/types.ts'
import type { Setlist, SetlistSong, Song } from '@shared/types.ts'
import { cn } from '../lib/cn.ts'
import { useAppStore } from '../store/useAppStore.ts'
import { useMutations, useSongs } from '../hooks/useQueries.ts'
import { Btn, KeyBadge, Pill } from './ui.tsx'
import { useQueryClient } from '@tanstack/react-query'

type Row =
  | { type: 'header'; id: string; artist: string; count: number }
  | { type: 'song'; id: string; song: Song }

export function LibraryView({
  setlistId,
  setlistSongs,
}: {
  setlistId: string | null
  setlistSongs: SetlistSong[]
}) {
  const [search, setSearch] = useState('')
  const [artist, setArtist] = useState('')
  const [tag, setTag] = useState('')
  const [sort, setSort] = useState<'artist' | 'title' | 'bpm'>('artist')
  const openEditor = useAppStore((s) => s.openEditor)
  const setBulkImportOpen = useAppStore((s) => s.setBulkImportOpen)
  const storeSetlistId = useAppStore((s) => s.activeSetlistId)
  const targetSetlistId = setlistId ?? storeSetlistId
  const [addError, setAddError] = useState<string | null>(null)
  const { addSong } = useMutations()
  const { data: songs = [], isLoading } = useSongs({ search, artist, tag, sort })
  const qc = useQueryClient()

  const inSetlist = useMemo(() => new Set(setlistSongs.map((s) => s.songId)), [setlistSongs])
  const artists = useMemo(() => {
    const set = new Set(songs.map((s) => s.artist).filter(Boolean))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [songs])

  const grouped = useMemo(() => {
    const rows: Row[] = []
    const unfiltered = !artist && !tag && !search && sort === 'artist'
    if (unfiltered) {
      let current = ''
      let count = 0
      const byArtist = new Map<string, Song[]>()
      for (const s of songs) {
        const list = byArtist.get(s.artist) ?? []
        list.push(s)
        byArtist.set(s.artist, list)
      }
      for (const [name, list] of byArtist) {
        rows.push({ type: 'header', id: `h-${name}`, artist: name, count: list.length })
        for (const song of list) rows.push({ type: 'song', id: song.id, song })
        current = name
        count += list.length
      }
      void current
      void count
    } else {
      for (const song of songs) rows.push({ type: 'song', id: song.id, song })
    }
    return rows
  }, [songs, artist, tag, search, sort])

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: grouped.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (grouped[i]?.type === 'header' ? 36 : 56),
    overscan: 10,
  })

  const addedCount = songs.filter((s) => inSetlist.has(s.id)).length
  const useVirtual = grouped.length > 80

  const addToSetlist = (song: Song) => {
    if (!targetSetlistId) {
      setAddError('Open a setlist, then add songs to it.')
      return
    }
    setAddError(null)
    addSong.mutate(
      { setlistId: targetSetlistId, songId: song.id },
      {
        onSuccess: (row) => {
          qc.setQueryData<Setlist>(['setlist', targetSetlistId], (prev) => {
            if (!prev) return prev
            const list = prev.songs ?? []
            if (list.some((s) => s.id === row.id || s.songId === song.id)) return prev
            return { ...prev, songs: [...list, row] }
          })
        },
        onError: (err) => {
          setAddError(err instanceof Error ? err.message : 'Could not add that song.')
        },
      },
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5">
        <h1 className="font-serif text-[28px] font-bold">Song Library</h1>
        <div className="flex gap-2">
          <Btn
            ghost
            onClick={async () => {
              const { endpoints } = await import('../lib/api.ts')
              const { downloadText } = await import('../lib/pdf.ts')
              const body = await endpoints.exportSongs()
              downloadText('setflow-songs.txt', body)
            }}
          >
            Export
          </Btn>
          <Btn ghost onClick={() => setBulkImportOpen(true)}>
            Import
          </Btn>
          <Btn accent onClick={() => openEditor(null)}>
            <Plus size={14} /> New Song
          </Btn>
        </div>
      </div>

      <div className="px-6 pt-4">
        <div
          className="flex h-10 items-center gap-2 rounded-[8px] px-3"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <Search size={16} style={{ color: 'var(--text-dim)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, artist, album"
            className="h-full w-full bg-transparent text-[13px] outline-none"
          />
        </div>
      </div>

      <div className="mt-3 flex gap-1.5 overflow-x-auto px-6">
        <Pill active={!artist} onClick={() => setArtist('')}>
          All artists
        </Pill>
        {artists.map((a) => (
          <Pill key={a} active={artist === a} onClick={() => setArtist(artist === a ? '' : a)}>
            {a}
          </Pill>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5 overflow-x-auto px-6">
        {TAGS.map((t) => (
          <Pill key={t} active={tag === t} onClick={() => setTag(tag === t ? '' : t)}>
            {t}
          </Pill>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-end px-6">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="h-8 rounded-[6px] px-2 text-[12px]"
          style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)' }}
        >
          <option value="artist">Sort: Artist</option>
          <option value="title">Sort: Title</option>
          <option value="bpm">Sort: BPM</option>
        </select>
      </div>

      {addError ? (
        <div className="px-6 pt-2 text-[12px]" style={{ color: 'var(--warn)' }}>
          {addError}
        </div>
      ) : null}

      <div ref={parentRef} className="scrollbar-thin mt-2 min-h-0 flex-1 overflow-y-auto px-4">
        {isLoading ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton h-12" />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <div className="px-4 py-12 text-center text-[13px]" style={{ color: 'var(--text-dim)' }}>
            No songs yet. Click + New Song to add your first chart.
          </div>
        ) : useVirtual ? (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((v) => {
              const row = grouped[v.index]
              return (
                <div
                  key={row.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: v.size,
                    transform: `translateY(${v.start}px)`,
                  }}
                >
                  {row.type === 'header' ? (
                    <div
                      className="px-2 pt-3 text-[10px] font-semibold tracking-[0.14em]"
                      style={{ color: 'var(--text-faint)' }}
                    >
                      {row.artist.toUpperCase()} · {row.count} {row.count === 1 ? 'song' : 'songs'}
                    </div>
                  ) : (
                    <LibraryRow
                      song={row.song}
                      added={inSetlist.has(row.song.id)}
                      onAdd={() => addToSetlist(row.song)}
                      onEdit={() => openEditor(row.song.id)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          grouped.map((row) =>
            row.type === 'header' ? (
              <div
                key={row.id}
                className="px-2 pt-3 text-[10px] font-semibold tracking-[0.14em]"
                style={{ color: 'var(--text-faint)' }}
              >
                {row.artist.toUpperCase()} · {row.count} {row.count === 1 ? 'song' : 'songs'}
              </div>
            ) : (
              <LibraryRow
                key={row.id}
                song={row.song}
                added={inSetlist.has(row.song.id)}
                onAdd={() => addToSetlist(row.song)}
                onEdit={() => openEditor(row.song.id)}
              />
            ),
          )
        )}
      </div>

      <div className="px-6 py-3 text-[12px]" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-dim)' }}>
        {songs.length} songs · {addedCount} in setlist
      </div>
    </div>
  )
}

function LibraryRow({
  song,
  added,
  onAdd,
  onEdit,
}: {
  song: Song
  added: boolean
  onAdd: () => void
  onEdit: () => void
}) {
  return (
    <div
      className={cn('flex h-14 items-center gap-3 rounded-[8px] px-2', added && 'opacity-55')}
    >
      <KeyBadge value={song.key} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px]">{song.title}</div>
        <div className="truncate text-[11px]" style={{ color: 'var(--text-dim)' }}>
          {song.artist} · {song.bpm} · {song.tag}
        </div>
      </div>
      <button type="button" onClick={onEdit} style={{ color: 'var(--text-dim)' }} title="Edit">
        <Pencil size={14} />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onAdd()
        }}
        disabled={added}
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
}
