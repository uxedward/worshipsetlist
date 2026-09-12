import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useLayoutEffect } from 'react'
import { endpoints, flushQueue, pingHealth } from '../lib/api.ts'
import { useAppStore } from '../store/useAppStore.ts'
import type { Preference, Setlist, SetlistSong, Song, SongInput } from '@shared/types.ts'
import {
  appendSetlistSong,
  extraSongs,
  forgetExtraSongs,
  overlaySetlist,
  overlaySetlists,
  overlaySong,
  overlaySongs,
  patchPersistedSetlistSong,
  rememberDeletedSetlist,
  rememberDeletedSong,
  rememberSetlist,
  rememberSong,
  rememberSongs,
  songFromInput,
  songToInput,
  removePersistedSetlistSong,
  reorderPersistedSetlist,
  reorderPersistedSetlists,
} from '../lib/persist.ts'
import { songsListQueryKey } from '../lib/queryKeys.ts'
import { sameSongIdentity, songInputFromSpotifyTrack } from '@shared/spotifyImport.ts'
import { readBootstrapCache, writeBootstrapCache } from '../lib/bootstrapCache.ts'
import type { BootstrapPayload } from '../lib/bootstrapCache.ts'

function hydrateBootstrap(raw: BootstrapPayload | null): BootstrapPayload | null {
  if (!raw) return null
  try {
    const setlists = overlaySetlists(raw.setlists)
    const songs = overlaySongs(raw.songs)
    const activeSetlist = raw.activeSetlist ? overlaySetlist(raw.activeSetlist) : null
    return { preferences: raw.preferences, setlists, songs, activeSetlist }
  } catch {
    return raw
  }
}

const cachedBootstrap = hydrateBootstrap(readBootstrapCache())

export function useBootstrap() {
  const qc = useQueryClient()
  const seed = (payload: BootstrapPayload) => {
    qc.setQueryData(['preferences'], payload.preferences)
    qc.setQueryData(['setlists'], payload.setlists)
    qc.setQueryData(songsListQueryKey(), payload.songs)
    if (payload.activeSetlist) {
      qc.setQueryData(['setlist', payload.activeSetlist.id], payload.activeSetlist)
    }
    writeBootstrapCache(payload)
  }

  useLayoutEffect(() => {
    if (cachedBootstrap) seed(cachedBootstrap)
  }, [])

  return useQuery({
    queryKey: ['bootstrap'],
    staleTime: 60_000,
    retry: 1,
    // Cached initialData paints immediately. updatedAt 0 marks it stale so
    // the default refetchOnMount:true still pulls a fresh copy in the background.
    initialData: cachedBootstrap ?? undefined,
    initialDataUpdatedAt: cachedBootstrap ? 0 : undefined,
    queryFn: async () => {
      try {
        const data = await endpoints.bootstrap()
        try {
          const setlists = overlaySetlists(data.setlists)
          const songs = overlaySongs(data.songs)
          const activeSetlist = data.activeSetlist ? overlaySetlist(data.activeSetlist) : null
          const payload = { preferences: data.preferences, setlists, songs, activeSetlist }
          seed(payload)
          return payload
        } catch {
          const songs = overlaySongs(data.songs)
          const payload = {
            preferences: data.preferences,
            setlists: data.setlists,
            songs,
            activeSetlist: data.activeSetlist,
          }
          seed(payload)
          return payload
        }
      } catch (err) {
        const setlists = overlaySetlists([])
        const songs = overlaySongs([])
        if (setlists.length === 0 && songs.length === 0) throw err
        const preferences: Preference = {
          id: 1,
          theme: 'dark',
          presentationFontSize: 'medium',
          lastSetlistId: setlists[0]?.id ?? null,
        }
        const activeSetlist =
          setlists.find((s) => s.id === preferences.lastSetlistId) ?? setlists[0] ?? null
        const payload = { preferences, setlists, songs, activeSetlist }
        seed(payload)
        return payload
      }
    },
  })
}

export function usePreferences(enabled = true) {
  return useQuery({
    queryKey: ['preferences'],
    queryFn: endpoints.prefs,
    enabled,
    staleTime: 60_000,
  })
}

export function useSetlists(enabled = true) {
  return useQuery({
    queryKey: ['setlists'],
    queryFn: async () => overlaySetlists(await endpoints.setlists()),
    enabled,
    staleTime: 60_000,
  })
}

export function useSetlist(id: string | null) {
  return useQuery({
    queryKey: ['setlist', id],
    queryFn: async () => overlaySetlist(await endpoints.setlist(id!)),
    enabled: Boolean(id),
    staleTime: 60_000,
  })
}

export function useSongs(
  params: { search?: string; artist?: string; tag?: string; sort?: string },
  enabled = true,
) {
  const q = new URLSearchParams()
  if (params.search) q.set('search', params.search)
  if (params.artist) q.set('artist', params.artist)
  if (params.tag) q.set('tag', params.tag)
  if (params.sort) q.set('sort', params.sort)
  const qs = q.toString() ? `?${q.toString()}` : ''
  return useQuery({
    queryKey: songsListQueryKey(params),
    queryFn: async () => overlaySongs(await endpoints.songs(qs)),
    enabled,
    staleTime: 60_000,
  })
}

export function useSong(id: string | null) {
  return useQuery({
    queryKey: ['song', id],
    queryFn: async () => {
      try {
        return overlaySong(id!, await endpoints.song(id!))
      } catch {
        const local = overlaySong(id!, null)
        if (local) return local
        throw new Error('Song not found')
      }
    },
    enabled: Boolean(id),
    staleTime: 60_000,
  })
}

function findSongInCache(qc: ReturnType<typeof useQueryClient>, songId: string): Song | undefined {
  const cached = qc.getQueryData<Song>(['song', songId])
  if (cached) return cached
  for (const [, songs] of qc.getQueriesData<Song[]>({ queryKey: ['songs'] })) {
    const hit = songs?.find((s) => s.id === songId)
    if (hit) return hit
  }
  return overlaySong(songId, null) ?? undefined
}

function nextSetlistOrder(qc: ReturnType<typeof useQueryClient>, setlistId: string) {
  const current = qc.getQueryData<Setlist>(['setlist', setlistId])
  return (current?.songs ?? []).reduce((max, row) => Math.max(max, row.order), -1) + 1
}

function putSetlistSong(
  qc: ReturnType<typeof useQueryClient>,
  setlistId: string,
  row: SetlistSong,
) {
  appendSetlistSong(setlistId, row)
  let added = false
  qc.setQueryData<Setlist>(['setlist', setlistId], (prev) => {
    if (!prev) return prev
    const songs = prev.songs ?? []
    if (songs.some((s) => s.id === row.id || s.songId === row.songId)) return prev
    added = true
    const next = { ...prev, songs: [...songs, row], _count: { songs: songs.length + 1 } }
    rememberSetlist(next)
    return next
  })
  if (!added) return
  const detail = qc.getQueryData<Setlist>(['setlist', setlistId])
  const nextCount = detail?.songs?.length
  const listed = qc.getQueryData<Setlist[]>(['setlists'])
  if (listed && typeof nextCount === 'number') {
    qc.setQueryData<Setlist[]>(
      ['setlists'],
      listed.map((s) => (s.id === setlistId ? { ...s, _count: { songs: nextCount } } : s)),
    )
  }
}

function replaceSetlistSong(
  qc: ReturnType<typeof useQueryClient>,
  setlistId: string,
  fromId: string,
  row: SetlistSong,
) {
  qc.setQueryData<Setlist>(['setlist', setlistId], (prev) => {
    if (!prev?.songs) return prev
    return {
      ...prev,
      songs: prev.songs.map((s) =>
        s.id === fromId || s.songId === row.songId ? { ...row, song: row.song ?? s.song } : s,
      ),
    }
  })
}

function dropSongFromCaches(qc: ReturnType<typeof useQueryClient>, songId: string) {
  qc.removeQueries({ queryKey: ['song', songId] })
  qc.setQueriesData<Song[]>({ queryKey: ['songs'] }, (prev) => prev?.filter((s) => s.id !== songId))
  qc.setQueriesData<Setlist>({ queryKey: ['setlist'] }, (prev) => {
    if (!prev?.songs) return prev
    const songs = prev.songs.filter((row) => row.songId !== songId)
    if (songs.length === prev.songs.length) return prev
    return { ...prev, songs, _count: { songs: songs.length } }
  })
  qc.setQueryData<Setlist[]>(['setlists'], (prev) =>
    prev?.map((s) => {
      const detail = qc.getQueryData<Setlist>(['setlist', s.id])
      return detail?._count ? { ...s, _count: detail._count } : s
    }),
  )
  const store = useAppStore.getState()
  if (store.editorSongId === songId) store.closeEditor()
  const activeId = store.activeSetlistId
  const activeRow = activeId
    ? qc.getQueryData<Setlist>(['setlist', activeId])?.songs?.find((row) => row.id === store.activeSetlistSongId)
    : undefined
  if (!activeRow || activeRow.songId === songId) store.setActiveSetlistSongId(null)
}

function patchSetlistCaches(
  qc: ReturnType<typeof useQueryClient>,
  id: string,
  patch: Record<string, unknown>,
) {
  qc.setQueryData<Setlist>(['setlist', id], (prev) => (prev ? { ...prev, ...patch } : prev))
  qc.setQueryData<Setlist[]>(['setlists'], (prev) => prev?.map((s) => (s.id === id ? { ...s, ...patch } : s)))
}

function upsertSongInCaches(qc: ReturnType<typeof useQueryClient>, song: Song) {
  qc.setQueryData(['song', song.id], song)
  qc.setQueriesData<Song[]>({ queryKey: ['songs'] }, (prev) => {
    if (!prev) return prev
    if (prev.some((s) => s.id === song.id)) return prev.map((s) => (s.id === song.id ? song : s))
    return [song, ...prev]
  })
}

function useTrackedMutation<TData, TVars>(
  fn: (vars: TVars) => Promise<TData>,
  onSettled?: () => void,
) {
  const setSaveStatus = useAppStore((s) => s.setSaveStatus)
  return useMutation({
    mutationFn: async (vars: TVars) => {
      setSaveStatus('saving')
      return fn(vars)
    },
    onSuccess: () => setSaveStatus('saved'),
    onError: () => setSaveStatus('failed'),
    onSettled,
  })
}

export function useMutations() {
  const qc = useQueryClient()
  const refreshLibrary = () => {
    void qc.invalidateQueries({ queryKey: ['songs'] })
    void qc.invalidateQueries({ queryKey: ['song'] })
  }

  return {
    patchPrefs: useTrackedMutation(async (body: Record<string, unknown>) => {
      try {
        return await endpoints.patchPrefs(body)
      } catch {
        return body
      }
    }, () => {
      void qc.invalidateQueries({ queryKey: ['preferences'] })
    }),
    createSetlist: useTrackedMutation(async (body: Record<string, unknown>) => {
      try {
        const created = await endpoints.createSetlist(body)
        rememberSetlist(created as Setlist)
        qc.setQueryData(['setlist', (created as Setlist).id], created)
        qc.setQueryData<Setlist[]>(['setlists'], (prev) =>
          prev?.some((s) => s.id === (created as Setlist).id)
            ? prev
            : [created as Setlist, ...(prev ?? [])],
        )
        return created
      } catch (err) {
        const local: Setlist = {
          id: `local-${crypto.randomUUID()}`,
          name: String(body.name ?? 'Untitled'),
          description: (body.description as string | null) ?? null,
          serviceName: (body.serviceName as string | null) ?? null,
          date: (body.date as string | null) ?? null,
          colorIndex: typeof body.colorIndex === 'number' ? body.colorIndex : 0,
          sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          songs: [],
          _count: { songs: 0 },
        }
        rememberSetlist(local)
        qc.setQueryData(['setlist', local.id], local)
        qc.setQueryData<Setlist[]>(['setlists'], (prev) => [local, ...(prev ?? [])])
        if (err instanceof Error && /not found/i.test(err.message)) throw err
        return local
      }
    }),
    patchSetlist: useTrackedMutation(async (v: { id: string; body: Record<string, unknown> }) => {
      const patch = { ...v.body, updatedAt: new Date().toISOString() }
      patchSetlistCaches(qc, v.id, patch)
      const current = qc.getQueryData<Setlist>(['setlist', v.id])
      if (current) rememberSetlist(current)
      try {
        const updated = (await endpoints.patchSetlist(v.id, v.body)) as Setlist
        rememberSetlist(overlaySetlist(updated))
        patchSetlistCaches(qc, v.id, updated as unknown as Record<string, unknown>)
        return updated
      } catch {
        return current
      }
    }),
    deleteSetlist: useTrackedMutation(async (id: string) => {
      rememberDeletedSetlist(id)
      qc.setQueryData<Setlist[]>(['setlists'], (prev) => prev?.filter((s) => s.id !== id))
      qc.removeQueries({ queryKey: ['setlist', id] })
      try {
        return await endpoints.deleteSetlist(id)
      } catch {
        return { ok: true }
      }
    }),
    duplicateSetlist: useTrackedMutation(async (id: string) => {
      try {
        const copy = (await endpoints.duplicateSetlist(id)) as Setlist
        rememberSetlist(copy)
        qc.setQueryData(['setlist', copy.id], copy)
        qc.setQueryData<Setlist[]>(['setlists'], (prev) => [copy, ...(prev ?? [])])
        return copy
      } catch {
        const source = qc.getQueryData<Setlist>(['setlist', id])
        const local: Setlist = {
          id: `local-${crypto.randomUUID()}`,
          name: `${source?.name ?? 'Setlist'} copy`,
          description: source?.description ?? null,
          serviceName: source?.serviceName ?? null,
          date: source?.date ?? null,
          colorIndex: source?.colorIndex ?? 0,
          sortOrder: (source?.sortOrder ?? 0) + 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          songs: source?.songs ?? [],
          _count: { songs: source?.songs?.length ?? 0 },
        }
        rememberSetlist(local)
        qc.setQueryData(['setlist', local.id], local)
        qc.setQueryData<Setlist[]>(['setlists'], (prev) => [local, ...(prev ?? [])])
        return local
      }
    }),
    addSong: useTrackedMutation(async (v: { setlistId: string; songId: string }) => {
      const current = qc.getQueryData<Setlist>(['setlist', v.setlistId])
      const existing = current?.songs?.find((row) => row.songId === v.songId)
      if (existing && !existing.id.startsWith('local-')) return existing
      const song = findSongInCache(qc, v.songId)
      const optimistic: SetlistSong = existing ?? {
        id: `local-${crypto.randomUUID()}`,
        setlistId: v.setlistId,
        songId: v.songId,
        order: nextSetlistOrder(qc, v.setlistId),
        transposedKey: null,
        notes: null,
        song: song ?? ({ id: v.songId, title: 'Song', artist: '', key: 'C', bpm: 80, timeSignature: '4/4', tag: 'Worship', album: null, durationSeconds: null, createdAt: new Date().toISOString() } as Song),
      }
      if (!existing) putSetlistSong(qc, v.setlistId, optimistic)
      try {
        const row = await endpoints.addSongToSetlist(v.setlistId, v.songId)
        replaceSetlistSong(qc, v.setlistId, optimistic.id, row)
        return row
      } catch {
        return optimistic
      }
    }),
    patchSetlistSong: useTrackedMutation(
      async (v: { setlistId: string; ssId: string; body: Record<string, unknown> }) => {
        patchPersistedSetlistSong(v.setlistId, v.ssId, {
          transposedKey: (v.body.transposedKey as string | null | undefined),
          notes: (v.body.notes as string | null | undefined),
          order: typeof v.body.order === 'number' ? v.body.order : undefined,
        })
        try {
          return await endpoints.patchSetlistSong(v.setlistId, v.ssId, v.body)
        } catch {
          return v.body
        }
      },
    ),
    removeSong: useTrackedMutation(async (v: { setlistId: string; ssId: string }) => {
      const current = qc.getQueryData<Setlist>(['setlist', v.setlistId])
      const songId = current?.songs?.find((row) => row.id === v.ssId)?.songId
      removePersistedSetlistSong(v.setlistId, v.ssId, songId)
      qc.setQueryData<Setlist>(['setlist', v.setlistId], (prev) => {
        if (!prev?.songs) return prev
        const songs = prev.songs.filter((row) => row.id !== v.ssId)
        return { ...prev, songs, _count: { songs: songs.length } }
      })
      const nextCount = qc.getQueryData<Setlist>(['setlist', v.setlistId])?.songs?.length
      if (typeof nextCount === 'number') {
        qc.setQueryData<Setlist[]>(['setlists'], (prev) =>
          prev?.map((s) => (s.id === v.setlistId ? { ...s, _count: { songs: nextCount } } : s)),
        )
      }
      try {
        return await endpoints.removeSetlistSong(v.setlistId, v.ssId)
      } catch {
        return { ok: true }
      }
    }),
    reorder: useTrackedMutation(async (v: { setlistId: string; orderedIds: string[] }) => {
      reorderPersistedSetlist(v.setlistId, v.orderedIds)
      try {
        return await endpoints.reorder(v.setlistId, v.orderedIds)
      } catch {
        return { ok: true }
      }
    }),
    reorderSetlists: useTrackedMutation(async (orderedIds: string[]) => {
      reorderPersistedSetlists(orderedIds)
      try {
        return await endpoints.reorderSetlists(orderedIds)
      } catch {
        return { ok: true }
      }
    }),
    createSong: useTrackedMutation(async (body: SongInput) => {
      try {
        const created = (await endpoints.createSong(body)) as Song
        rememberSong(created)
        upsertSongInCaches(qc, created)
        return created
      } catch (err) {
        const local = songFromInput(body)
        rememberSong(local)
        upsertSongInCaches(qc, local)
        throw err
      }
    }),
    patchSong: useTrackedMutation(async (v: { id: string; body: SongInput }) => {
      try {
        const updated = (await endpoints.patchSong(v.id, v.body)) as Song
        rememberSong(updated)
        upsertSongInCaches(qc, updated)
        return updated
      } catch (err) {
        const current = findSongInCache(qc, v.id)
        const local = { ...(current ?? { id: v.id }), ...v.body } as Song
        rememberSong(local)
        upsertSongInCaches(qc, local)
        throw err
      }
    }),
    deleteSong: useTrackedMutation(async (id: string) => {
      const fromSetlistIds: string[] = []
      for (const [, setlist] of qc.getQueriesData<Setlist>({ queryKey: ['setlist'] })) {
        if (setlist?.id && setlist.songs?.some((row) => row.songId === id)) {
          fromSetlistIds.push(setlist.id)
        }
      }
      rememberDeletedSong(id, fromSetlistIds)
      dropSongFromCaches(qc, id)
      try {
        return await endpoints.deleteSong(id)
      } catch {
        return { ok: true }
      }
    }),
    bulkImport: useTrackedMutation(async (text: string) => {
      return await endpoints.bulkImport(text)
    }, refreshLibrary),
    spotifyImport: useTrackedMutation(async (url: string) => {
      const lookup = await endpoints.spotifyLookup(url)
      let server: Song[] = []
      try {
        server = await endpoints.songs('')
      } catch {
        for (const [, songs] of qc.getQueriesData<Song[]>({ queryKey: ['songs'] })) {
          if (songs) server.push(...songs)
        }
      }
      const existing = overlaySongs(server)
      const created: Song[] = []
      let skipped = 0
      let remote = true
      for (const track of lookup.tracks) {
        if (existing.some((song) => sameSongIdentity(song, track)) || created.some((song) => sameSongIdentity(song, track))) {
          skipped++
          continue
        }
        const input = songInputFromSpotifyTrack(track)
        if (remote) {
          try {
            const song = (await endpoints.createSong(input)) as Song
            rememberSong(song)
            created.push(song)
            existing.push(song)
            continue
          } catch {
            remote = false
          }
        }
        const local = songFromInput(input)
        created.push(local)
        existing.push(local)
      }
      rememberSongs(created.filter((song) => song.id.startsWith('local-')))
      return {
        imported: created.length,
        skipped,
        name: lookup.name,
        titles: created.map((song) => song.title),
        message:
          skipped > 0
            ? `${created.length} imported from ${lookup.name}, ${skipped} already in the library`
            : `${created.length} imported from ${lookup.name}`,
      }
    }, refreshLibrary),
  }
}

export function optimisticSetlistSongs(
  qc: ReturnType<typeof useQueryClient>,
  setlistId: string,
  updater: (songs: SetlistSong[]) => SetlistSong[],
) {
  qc.setQueryData<Setlist>(['setlist', setlistId], (prev) => {
    if (!prev?.songs) return prev
    return { ...prev, songs: updater(prev.songs) }
  })
}

export async function flushLocalSongsToDatabase() {
  const pending = extraSongs()
  if (pending.length === 0) return
  const res = await endpoints.syncLocalSongs(pending.map(songToInput))
  if (res.durable || res.imported > 0) {
    forgetExtraSongs(pending.map((song) => song.id))
  }
}

export function useRetrySave() {
  const setSaveStatus = useAppStore((s) => s.setSaveStatus)
  const qc = useQueryClient()
  return async () => {
    setSaveStatus('saving')
    const ok = await pingHealth()
    if (!ok) {
      setSaveStatus('failed')
      return
    }
    try {
      await flushQueue()
      await flushLocalSongsToDatabase()
      setSaveStatus('saved')
      await qc.invalidateQueries()
    } catch {
      setSaveStatus('failed')
    }
  }
}

export type { Song, Setlist, SetlistSong }
