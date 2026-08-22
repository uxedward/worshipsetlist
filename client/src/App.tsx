import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useAppStore } from './store/useAppStore.ts'
import { useMutations, usePreferences, useSetlist, useSetlists, useSongs } from './hooks/useQueries.ts'
import { useOfflineSync } from './hooks/useOfflineSync.ts'
import { AppShell } from './components/AppShell.tsx'
import { SongEditor } from './components/SongEditor.tsx'
import { PresentationOverlay } from './components/PresentationOverlay.tsx'
import { SetlistEditModal } from './components/SetlistEditModal.tsx'
import { BulkImportModal, ExportModal } from './components/Modals.tsx'
import { SetlistContextMenu } from './components/SetlistContextMenu.tsx'
import { ConfirmDialog, OfflineBanner } from './components/ui.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 10_000,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInner />
    </QueryClientProvider>
  )
}

function AppInner() {
  useOfflineSync()
  const prefs = usePreferences()
  const setlists = useSetlists()
  const songsQuery = useSongs({})
  const activeSetlistId = useAppStore((s) => s.activeSetlistId)
  const setActiveSetlistId = useAppStore((s) => s.setActiveSetlistId)
  const setTheme = useAppStore((s) => s.setTheme)
  const setFontSize = useAppStore((s) => s.setFontSize)
  const theme = useAppStore((s) => s.theme)
  const playing = useAppStore((s) => s.playing)
  const activeSsId = useAppStore((s) => s.activeSetlistSongId)
  const setElapsed = useAppStore((s) => s.setElapsed)
  const setPlaying = useAppStore((s) => s.setPlaying)
  const { patchPrefs } = useMutations()
  const lastPrefWrite = useRef<string | null>(null)

  useEffect(() => {
    if (!prefs.data) return
    setTheme(prefs.data.theme)
    setFontSize(prefs.data.presentationFontSize)
    if (!activeSetlistId && prefs.data.lastSetlistId) {
      setActiveSetlistId(prefs.data.lastSetlistId)
    }
  }, [prefs.data, activeSetlistId, setActiveSetlistId, setFontSize, setTheme])

  useEffect(() => {
    if (!activeSetlistId && setlists.data?.[0]) {
      setActiveSetlistId(setlists.data[0].id)
    }
  }, [setlists.data, activeSetlistId, setActiveSetlistId])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#1C1612' : '#F7F3EE')
    if (lastPrefWrite.current !== theme && prefs.data && prefs.data.theme !== theme) {
      lastPrefWrite.current = theme
      patchPrefs.mutate({ theme })
    }
  }, [theme, patchPrefs, prefs.data])

  useEffect(() => {
    if (activeSetlistId && prefs.data && prefs.data.lastSetlistId !== activeSetlistId) {
      patchPrefs.mutate({ lastSetlistId: activeSetlistId })
    }
  }, [activeSetlistId, patchPrefs, prefs.data])

  const setlistQuery = useSetlist(activeSetlistId)
  const setlist = setlistQuery.data
  const setlistSongs = setlist?.songs ?? []

  useEffect(() => {
    if (!playing) return
    const current = setlistSongs.find((s) => s.id === activeSsId) ?? setlistSongs[0]
    const duration = current?.song.durationSeconds ?? 0
    const iv = window.setInterval(() => {
      setElapsed((n) => {
        if (duration && n + 1 >= duration) {
          const idx = setlistSongs.findIndex((s) => s.id === current?.id)
          if (idx >= 0 && idx < setlistSongs.length - 1) {
            useAppStore.getState().setActiveSetlistSongId(setlistSongs[idx + 1].id)
            return 0
          }
          setPlaying(false)
          return n
        }
        return n + 1
      })
    }, 1000)
    return () => window.clearInterval(iv)
  }, [playing, activeSsId, setlistSongs, setElapsed, setPlaying])

  const loading = prefs.isLoading || setlists.isLoading

  if (loading) {
    return (
      <div className="flex h-full" style={{ background: 'var(--bg)' }}>
        <div className="hidden h-full w-[260px] p-4 lg:block" style={{ background: 'var(--surface)' }}>
          <div className="skeleton mb-6 h-10 w-32" />
          <div className="skeleton mb-2 h-12 w-full" />
          <div className="skeleton mb-2 h-12 w-full" />
          <div className="skeleton h-12 w-full" />
        </div>
        <div className="flex-1 p-8">
          <div className="skeleton mb-6 h-24 w-2/3" />
          <div className="skeleton mb-3 h-12 w-full" />
          <div className="skeleton mb-3 h-12 w-full" />
          <div className="skeleton h-12 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <OfflineBanner />
      <AppShell
        setlists={setlists.data ?? []}
        setlist={setlist}
        songs={setlistSongs}
        songCount={songsQuery.data?.length ?? 0}
      />
      <SongEditor />
      <PresentationOverlay songs={setlistSongs} />
      <SetlistEditModal setlists={setlists.data ?? []} />
      <BulkImportModal />
      <ExportModal setlistName={setlist?.name ?? 'Setlist'} songs={setlistSongs} />
      <SetlistContextMenu />
      <ConfirmDialog />
    </div>
  )
}
