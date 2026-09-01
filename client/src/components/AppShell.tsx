import type { Setlist, SetlistSong } from '@shared/types.ts'
import { keyJump, soundingKey } from '@shared/transpose.ts'
import { formatDurationLong } from '@shared/duration.ts'
import { useAppStore } from '../store/useAppStore.ts'
import { useIsDesktop, useIsMobile, useIsTablet } from '../hooks/useMediaQuery.ts'
import { Sidebar } from './Sidebar.tsx'
import { SetlistHeader } from './SetlistHeader.tsx'
import { SongTable } from './SongTable.tsx'
import { SongDetailPanel } from './SongDetailPanel.tsx'
import { Playbar, MiniPlayer } from './Playbar.tsx'
import { LibraryView } from './LibraryView.tsx'
import { MobileNav } from './MobileNav.tsx'
import { Minus, Play, Plus } from 'lucide-react'
import { Btn, KeyBadge, Pill } from './ui.tsx'
import { ChordChart } from './ChordChart.tsx'
import { preferFlatsForKey, semitonesFromKeys, transposeKey } from '@shared/transpose.ts'
import { useMutations, useSong } from '../hooks/useQueries.ts'
import { useDebouncedCallback } from '../hooks/useDebouncedCallback.ts'
import { TRANSPOSE_MAX, TRANSPOSE_MIN } from '@shared/types.ts'

export function AppShell({
  setlists,
  setlist,
  songs,
  songCount,
}: {
  setlists: Setlist[]
  setlist: Setlist | undefined
  songs: SetlistSong[]
  songCount: number
}) {
  const isDesktop = useIsDesktop()
  const isTablet = useIsTablet()
  const isMobile = useIsMobile()
  const mainView = useAppStore((s) => s.mainView)
  const mobileTab = useAppStore((s) => s.mobileTab)
  const sidebarHover = useAppStore((s) => s.sidebarHover)
  const drawerOpen = useAppStore((s) => s.drawerOpen)
  const setDrawerOpen = useAppStore((s) => s.setDrawerOpen)
  const activeSsId = useAppStore((s) => s.activeSetlistSongId)
  const activeSs = songs.find((s) => s.id === activeSsId) ?? null

  const warnings = songs.filter((ss, i) => {
    if (i === 0) return false
    return keyJump(soundingKey(songs[i - 1].song.key, songs[i - 1].transposedKey), soundingKey(ss.song.key, ss.transposedKey)) > 3
  }).length
  const total = songs.reduce((s, x) => s + (x.song.durationSeconds ?? 0), 0)
  const keys = Array.from(new Set(songs.map((s) => soundingKey(s.song.key, s.transposedKey))))

  const mainSetlist = setlist ? (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
      <SetlistHeader setlist={setlist} songs={songs} />
      {isMobile ? (
        <div className="mx-4 mb-3 flex flex-wrap gap-2 text-[11px]" style={{ color: 'var(--text-dim)' }}>
          <span>{songs.length} songs</span>
          <span>{formatDurationLong(total)}</span>
          <span>{keys.join(', ') || 'No keys'}</span>
          {warnings > 0 ? <span style={{ color: 'var(--warn)' }}>{warnings} key warnings</span> : null}
        </div>
      ) : null}
      <SongTable setlistId={setlist.id} songs={songs} />
    </div>
  ) : (
    <div className="flex flex-1 items-center justify-center text-[13px]" style={{ color: 'var(--text-dim)' }}>
      Create a setlist to get started
    </div>
  )

  const showLibrary = isMobile ? mobileTab === 'library' : mainView === 'library'
  const showSetlist = isMobile ? mobileTab === 'setlist' : !showLibrary

  return (
    <div className="flex min-h-0 flex-1">
      {isDesktop ? (
        <Sidebar setlists={setlists} songCount={songCount} />
      ) : isTablet ? (
        <>
          <Sidebar setlists={setlists} songCount={songCount} collapsed />
          {sidebarHover ? <Sidebar setlists={setlists} songCount={songCount} overlay /> : null}
        </>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col" style={{ background: 'var(--bg)' }}>
            {isMobile ? (showSetlist ? mainSetlist : showLibrary ? <LibraryView setlistId={setlist?.id ?? null} setlistSongs={songs} /> : <MobileSongView songs={songs} />) : showLibrary ? (
              <LibraryView setlistId={setlist?.id ?? null} setlistSongs={songs} />
            ) : (
              mainSetlist
            )}
          </div>

          {isDesktop ? (
            <div className="h-full w-[340px] shrink-0" style={{ background: 'var(--surface)', borderLeft: '1px solid var(--border)' }}>
              <SongDetailPanel setlistSong={activeSs} />
            </div>
          ) : null}
        </div>

        {isMobile ? <MiniPlayer setlist={setlist ?? setlists[0]} songs={songs} /> : <Playbar setlist={setlist ?? setlists[0]} songs={songs} />}
        {isMobile ? <MobileNav /> : null}
      </div>

      {isTablet && activeSs && drawerOpen ? (
        <div className="fixed inset-0 z-40" onClick={() => setDrawerOpen(false)}>
          <div
            className="absolute inset-x-0 bottom-0 flex h-[60%] flex-col rounded-t-[16px]"
            style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center py-2">
              <div className="h-1 w-12 rounded-full" style={{ background: 'var(--border)' }} />
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <SongDetailPanel setlistSong={activeSs} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MobileSongView({ songs }: { songs: SetlistSong[] }) {
  const activeId = useAppStore((s) => s.activeSetlistSongId)
  const setActive = useAppStore((s) => s.setActiveSetlistSongId)
  const lyricsOnly = useAppStore((s) => s.lyricsOnly)
  const setLyricsOnly = useAppStore((s) => s.setLyricsOnly)
  const openPresentation = useAppStore((s) => s.openPresentation)
  const sectionIndex = useAppStore((s) => s.activeSectionIndex)
  const setSection = useAppStore((s) => s.setActiveSectionIndex)
  const { patchSetlistSong } = useMutations()

  const index = Math.max(0, songs.findIndex((s) => s.id === activeId))
  const current = songs[index]
  const { data: full } = useSong(current?.songId ?? null)
  const song = full ?? current?.song
  const persistTranspose = useDebouncedCallback((ssId: string, transposedKey: string | null) => {
    if (!current) return
    patchSetlistSong.mutate({ setlistId: current.setlistId, ssId, body: { transposedKey } })
  }, 500)

  if (!current || !song) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-[13px]" style={{ color: 'var(--text-dim)' }}>
        Select a song from the setlist
      </div>
    )
  }

  const key = soundingKey(song.key, current.transposedKey)
  const offset = current.transposedKey ? semitonesFromKeys(song.key, current.transposedKey) : 0
  const sections = [...(song.sections ?? [])].sort((a, b) => a.order - b.order)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start justify-between px-4 pt-4">
        <div>
          <h1 className="font-serif text-[24px] font-bold">{song.title}</h1>
          <div className="text-[12px]" style={{ color: 'var(--text-dim)' }}>
            {song.artist}
          </div>
        </div>
        <Btn accent onClick={openPresentation}>
          <Play size={14} fill="currentColor" />
        </Btn>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 px-4">
        <Pill accent>Key of {key}</Pill>
        <Pill>{song.bpm} BPM</Pill>
        <Pill>{song.timeSignature}</Pill>
        <Pill>{song.tag}</Pill>
      </div>
      <div className="mt-3 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-[8px]"
            style={{ background: 'var(--card)' }}
            disabled={offset <= TRANSPOSE_MIN}
            onClick={() => {
              const next = transposeKey(key, -1)
              persistTranspose(current.id, next === song.key ? null : next)
            }}
          >
            <Minus size={14} />
          </button>
          <KeyBadge value={key} />
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-[8px]"
            style={{ background: 'var(--card)' }}
            disabled={offset >= TRANSPOSE_MAX}
            onClick={() => {
              const next = transposeKey(key, 1)
              persistTranspose(current.id, next === song.key ? null : next)
            }}
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="inline-flex rounded-[20px] p-0.5" style={{ background: 'var(--card)' }}>
          <button
            type="button"
            className="rounded-[20px] px-3 py-1 text-[12px]"
            style={{ background: !lyricsOnly ? 'var(--accent)' : 'transparent', color: !lyricsOnly ? '#fff' : 'var(--text-dim)' }}
            onClick={() => setLyricsOnly(false)}
          >
            Chords
          </button>
          <button
            type="button"
            className="rounded-[20px] px-3 py-1 text-[12px]"
            style={{ background: lyricsOnly ? 'var(--accent)' : 'transparent', color: lyricsOnly ? '#fff' : 'var(--text-dim)' }}
            onClick={() => setLyricsOnly(true)}
          >
            Lyrics
          </button>
        </div>
      </div>
      <div className="mt-3 flex gap-1.5 overflow-x-auto px-4">
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
      <div className="scrollbar-thin mt-3 min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <ChordChart
          sections={sections}
          lyricsOnly={lyricsOnly}
          semitones={offset}
          preferFlats={preferFlatsForKey(key)}
          highlightSection={sectionIndex}
        />
      </div>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
        <Btn
          ghost
          onClick={() => {
            if (sectionIndex > 0) setSection(sectionIndex - 1)
            else if (index > 0) {
              setActive(songs[index - 1].id)
              setSection(0)
            }
          }}
        >
          ← Prev
        </Btn>
        <span className="text-[12px]" style={{ color: 'var(--text-dim)' }}>
          Section {sections.length ? sectionIndex + 1 : 0} of {sections.length}
        </span>
        <Btn
          ghost
          onClick={() => {
            if (sectionIndex < sections.length - 1) setSection(sectionIndex + 1)
            else if (index < songs.length - 1) {
              setActive(songs[index + 1].id)
              setSection(0)
            }
          }}
        >
          Next →
        </Btn>
      </div>
    </div>
  )
}
