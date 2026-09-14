import { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { displaySongMeta } from '@shared/bulkFormat.ts'
import type { SetlistSong, Song } from '@shared/types.ts'
import { cn } from '../lib/cn.ts'
import { useAppStore } from '../store/useAppStore.ts'
import { useMutations, useSongs } from '../hooks/useQueries.ts'
import { Btn, KeyBadge, Spinner } from './ui.tsx'
import { AddToSetlistModal } from './AddToSetlistModal.tsx'

type Row =
  | { type: 'header'; id: string; artist: string; count: number }
  | { type: 'song'; id: string; song: Song }

type ArtistGroup = { artist: string; songs: Song[] }

export function LibraryView({
  setlistSongs,
}: {
  setlistId?: string | null
  setlistSongs: SetlistSong[]
}) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'artist' | 'title' | 'bpm'>('artist')
  const openEditor = useAppStore((s) => s.openEditor)
  const setBulkImportOpen = useAppStore((s) => s.setBulkImportOpen)
  const askConfirm = useAppStore((s) => s.askConfirm)
  const [pendingSong, setPendingSong] = useState<Song | null>(null)
  const [addError, setAddError] = useState<string | null>(null)
  const [addingIds, setAddingIds] = useState<Set<string>>(() => new Set())
  const { deleteSong } = useMutations()
  const { data: songs = [], isLoading } = useSongs({ search, sort })

  const inSetlist = useMemo(() => new Set(setlistSongs.map((s) => s.songId)), [setlistSongs])
  const visibleSongs = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return songs
    return songs.filter((s) => {
      const album = s.album ?? ''
      return (
        s.title.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        album.toLowerCase().includes(q)
      )
    })
  }, [songs, search])

  const artistGroups = useMemo((): ArtistGroup[] | null => {
    if (search || sort !== 'artist') return null
    const byArtist = new Map<string, Song[]>()
    for (const s of visibleSongs) {
      const list = byArtist.get(s.artist) ?? []
      list.push(s)
      byArtist.set(s.artist, list)
    }
    return [...byArtist.entries()].map(([artist, songs]) => ({ artist, songs }))
  }, [visibleSongs, search, sort])

  const grouped = useMemo(() => {
    const rows: Row[] = []
    if (artistGroups) {
      for (const group of artistGroups) {
        rows.push({ type: 'header', id: `h-${group.artist}`, artist: group.artist, count: group.songs.length })
        for (const song of group.songs) rows.push({ type: 'song', id: song.id, song })
      }
    } else {
      for (const song of visibleSongs) rows.push({ type: 'song', id: song.id, song })
    }
    return rows
  }, [artistGroups, visibleSongs])

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: grouped.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => {
      if (grouped[i]?.type !== 'header') return 56
      return i === 0 ? 56 : 80
    },
    overscan: 10,
  })

  const addedCount = visibleSongs.filter((s) => inSetlist.has(s.id)).length
  const useVirtual = grouped.length > 80

  const addToSetlist = (song: Song) => {
    setAddError(null)
    setPendingSong(song)
  }

  const requestDelete = (song: Song) => {
    askConfirm({
      title: `Delete ${song.title}?`,
      message: 'This removes it from the library and every setlist.',
      danger: true,
      confirmLabel: 'Delete',
      onConfirm: () => deleteSong.mutate(song.id),
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5">
        <h1 className="text-title">Song library</h1>
        <div className="flex gap-2">
          <Btn
            onClick={async () => {
              const { endpoints } = await import('../lib/api.ts')
              const { downloadText } = await import('../lib/download.ts')
              const body = await endpoints.exportSongs()
              downloadText('setflow-songs.txt', body)
            }}
          >
            Export
          </Btn>
          <Btn onClick={() => setBulkImportOpen(true)}>
            Spotify / Import
          </Btn>
          <Btn accent onClick={() => openEditor(null)}>
            <Plus size={14} /> New song
          </Btn>
        </div>
      </div>

      <div className="px-6 pt-4">
        <div
          className="flex h-10 items-center gap-2 rounded-[8px] px-3"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
        >
          <Search size={16} style={{ color: 'var(--text-secondary)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, artist, album"
            className="h-full w-full bg-transparent text-[13px] outline-none"
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end px-6">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="h-8 rounded-[6px] px-2 text-[12px]"
          style={{ background: 'var(--surface-2)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
        >
          <option value="artist">Sort: Artist</option>
          <option value="title">Sort: Title</option>
          <option value="bpm">Sort: BPM</option>
        </select>
      </div>

      {addError ? (
        <div className="px-6 pt-2 text-[12px]" style={{ color: 'var(--warning)' }}>
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
          <div className="px-4 py-12 text-center">
            <p className="text-heading">Add your first song</p>
            <p className="mt-2 text-body" style={{ color: 'var(--text-muted)' }}>
              Import a public Spotify playlist or create a chart.
            </p>
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
                    <ArtistHeader artist={row.artist} count={row.count} first={v.index === 0} />
                  ) : (
                    <LibraryRow
                      song={row.song}
                      adding={addingIds.has(row.song.id)}
                      hideArtist={!search && sort === 'artist'}
                      onAdd={() => addToSetlist(row.song)}
                      onEdit={() => openEditor(row.song.id)}
                      onDelete={() => requestDelete(row.song)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        ) : artistGroups ? (
          <div className="flex flex-col gap-4 p-1 pb-4">
            {artistGroups.map((group) => (
              <ArtistGroupCard
                key={group.artist}
                artist={group.artist}
                songs={group.songs}
                addingIds={addingIds}
                onAdd={addToSetlist}
                onEdit={(song) => openEditor(song.id)}
                onDelete={requestDelete}
              />
            ))}
          </div>
        ) : (
          visibleSongs.map((song) => (
            <LibraryRow
              key={song.id}
              song={song}
              adding={addingIds.has(song.id)}
              hideArtist={false}
              onAdd={() => addToSetlist(song)}
              onEdit={() => openEditor(song.id)}
              onDelete={() => requestDelete(song)}
            />
          ))
        )}
      </div>

      <div className="px-6 py-3 text-[12px]" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
        {visibleSongs.length} {visibleSongs.length === 1 ? 'song' : 'songs'}
        {addedCount ? ` · ${addedCount} in the current setlist` : ''}
      </div>
      {pendingSong ? (
        <AddToSetlistModal
          song={pendingSong}
          onClose={() => setPendingSong(null)}
          onBusy={(busy) => {
            const id = pendingSong.id
            setAddingIds((prev) => {
              const next = new Set(prev)
              if (busy) next.add(id)
              else next.delete(id)
              return next
            })
          }}
        />
      ) : null}
    </div>
  )
}

function artistInitial(name: string) {
  const trimmed = name.trim()
  return trimmed ? trimmed[0]!.toUpperCase() : '?'
}

function artistMarkStyle(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  const tone = (hash % 4) + 2
  return {
    background: 'var(--surface-3)',
    color: `var(--arc-${tone})`,
    border: '1px solid var(--border-strong)',
  }
}

function ArtistMark({ artist }: { artist: string }) {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-[15px] font-medium"
      style={artistMarkStyle(artist)}
      aria-hidden
    >
      {artistInitial(artist)}
    </span>
  )
}

function ArtistHeading({ artist, count }: { artist: string; count: number }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <ArtistMark artist={artist} />
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-heading">{artist}</h2>
        <p className="text-caption tabular" style={{ color: 'var(--text-muted)' }}>
          {count} {count === 1 ? 'song' : 'songs'}
        </p>
      </div>
    </div>
  )
}

function ArtistHeader({
  artist,
  count,
  first,
}: {
  artist: string
  count: number
  first?: boolean
}) {
  return (
    <div className={cn('px-1', first ? 'pt-1' : 'pt-5')}>
      <div
        className="flex items-center rounded-[10px] px-3 py-2.5"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)' }}
      >
        <ArtistHeading artist={artist} count={count} />
      </div>
    </div>
  )
}

function ArtistGroupCard({
  artist,
  songs,
  addingIds,
  onAdd,
  onEdit,
  onDelete,
}: {
  artist: string
  songs: Song[]
  addingIds: Set<string>
  onAdd: (song: Song) => void
  onEdit: (song: Song) => void
  onDelete: (song: Song) => void
}) {
  return (
    <section
      className="overflow-hidden rounded-[12px]"
      style={{ background: 'var(--surface-1)', border: '1px solid var(--border-strong)' }}
    >
      <header
        className="flex items-center px-3 py-3"
        style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border-strong)' }}
      >
        <ArtistHeading artist={artist} count={songs.length} />
      </header>
      <div className="px-1 py-1">
        {songs.map((song) => (
          <LibraryRow
            key={song.id}
            song={song}
            adding={addingIds.has(song.id)}
            hideArtist
            onAdd={() => onAdd(song)}
            onEdit={() => onEdit(song)}
            onDelete={() => onDelete(song)}
          />
        ))}
      </div>
    </section>
  )
}

function LibraryRow({
  song,
  adding,
  hideArtist,
  onAdd,
  onEdit,
  onDelete,
}: {
  song: Song
  adding?: boolean
  hideArtist?: boolean
  onAdd: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const meta = displaySongMeta(song)
  return (
    <div
      className={cn('flex h-14 items-center gap-3 rounded-[8px] px-2')}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px]">{song.title}</div>
        {hideArtist ? null : (
          <div className="truncate text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            {song.artist}
          </div>
        )}
      </div>
      <KeyBadge value={meta.key} size="sm" />
      <span className="hidden w-10 shrink-0 text-center text-caption tabular sm:inline" style={{ color: 'var(--text-secondary)' }}>
        {meta.bpm}
      </span>
      <span
        className="hidden max-w-[88px] shrink-0 truncate rounded-[20px] px-2 py-0.5 text-[10px] sm:inline"
        style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
      >
        {meta.tag}
      </span>
      <button type="button" className="shrink-0" onClick={onEdit} style={{ color: 'var(--text-secondary)' }} title="Edit song" aria-label="Edit song">
        <Pencil size={14} />
      </button>
      <button
        type="button"
        className="shrink-0"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        style={{ color: 'var(--text-secondary)' }}
        title="Delete song"
        aria-label="Delete song"
      >
        <Trash2 size={14} />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (adding) return
          onAdd()
        }}
        disabled={adding}
        aria-busy={adding || undefined}
        className="flex h-8 shrink-0 items-center gap-1 rounded-[8px] px-2 text-[12px]"
        style={{
          background: adding ? 'transparent' : 'var(--surface-2)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-strong)',
        }}
      >
        {adding ? (
          <>
            <Spinner size={12} /> Adding
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
