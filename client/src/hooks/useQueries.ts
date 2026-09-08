import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
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
} from '../lib/persist.ts'
import { sameSongIdentity, songInputFromSpotifyTrack } from '@shared/spotifyImport.ts'

export function useBootstrap() {
  const qc = useQueryClient()
  return useQuery({
    queryKey: ['bootstrap'],
    queryFn: async () => {
      const seed = (payload: {
        preferences: Preference
        setlists: Setlist[]
        songs: Song[]
        activeSetlist: Setlist | null
      }) => {
        qc.setQueryData(['preferences'], payload.preferences)
        qc.setQueryData(['setlists'], payload.setlists)
        qc.setQueryData(['songs', {}], payload.songs)
        if (payload.activeSetlist) {
          qc.setQueryData(['setlist', payload.activeSetlist.id], payload.activeSetlist)
        }
      }
      try {
        const data = await endpoints.bootstrap()
        const setlists = overlaySetlists(data.setlists)
        const songs = overlaySongs(data.songs)
        const activeSetlist = data.activeSetlist ? overlaySetlist(data.activeSetlist) : null
        const payload = { preferences: data.preferences, setlists, songs, activeSetlist }
        seed(payload)
        return payload
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
  })
}

export function useSetlists(enabled = true) {
  return useQuery({
    queryKey: ['setlists'],
    queryFn: async () => overlaySetlists(await endpoints.setlists()),
    enabled,
  })
}

export function useSetlist(id: string | null) {
  return useQuery({
    queryKey: ['setlist', id],
    queryFn: async () => overlaySetlist(await endpoints.setlist(id!)),
    enabled: Boolean(id),
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
    queryKey: ['songs', params],
    queryFn: async () => overlaySongs(await endpoints.songs(qs)),
    enabled,
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
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['setlists'] })
    void qc.invalidateQueries({ queryKey: ['setlist'] })
    void qc.invalidateQueries({ queryKey: ['songs'] })
    void qc.invalidateQueries({ queryKey: ['song'] })
    void qc.invalidateQueries({ queryKey: ['preferences'] })
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
        return created
      } catch (err) {
        const local: Setlist = {
          id: `local-${crypto.randomUUID()}`,
          name: String(body.name ?? 'Untitled'),
          description: (body.description as string | null) ?? null,
          serviceName: (body.serviceName as string | null) ?? null,
          date: (body.date as string | null) ?? null,
          colorIndex: typeof body.colorIndex === 'number' ? body.colorIndex : 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          songs: [],
          _count: { songs: 0 },
        }
        rememberSetlist(local)
        if (err instanceof Error && /not found/i.test(err.message)) throw err
        return local
      }
    }, invalidate),
    patchSetlist: useTrackedMutation(async (v: { id: string; body: Record<string, unknown> }) => {
      try {
        const updated = (await endpoints.patchSetlist(v.id, v.body)) as Setlist
        rememberSetlist(overlaySetlist(updated))
        return updated
      } catch {
        const current = qc.getQueryData<Setlist>(['setlist', v.id])
        if (current) rememberSetlist({ ...current, ...v.body, updatedAt: new Date().toISOString() } as Setlist)
        return current
      }
    }, invalidate),
    deleteSetlist: useTrackedMutation(async (id: string) => {
      rememberDeletedSetlist(id)
      try {
        return await endpoints.deleteSetlist(id)
      } catch {
        return { ok: true }
      }
    }, invalidate),
    duplicateSetlist: useTrackedMutation(async (id: string) => {
      try {
        const copy = (await endpoints.duplicateSetlist(id)) as Setlist
        rememberSetlist(copy)
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
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          songs: source?.songs ?? [],
          _count: { songs: source?.songs?.length ?? 0 },
        }
        rememberSetlist(local)
        return local
      }
    }, invalidate),
    addSong: useTrackedMutation(async (v: { setlistId: string; songId: string }) => {
      let row: SetlistSong
      try {
        row = await endpoints.addSongToSetlist(v.setlistId, v.songId)
      } catch (err) {
        const song = findSongInCache(qc, v.songId)
        if (!song) throw err
        row = {
          id: `local-${crypto.randomUUID()}`,
          setlistId: v.setlistId,
          songId: v.songId,
          order: nextSetlistOrder(qc, v.setlistId),
          transposedKey: null,
          notes: null,
          song,
        }
      }
      putSetlistSong(qc, v.setlistId, row)
      return row
    }, invalidate),
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
      invalidate,
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
      try {
        return await endpoints.removeSetlistSong(v.setlistId, v.ssId)
      } catch {
        return { ok: true }
      }
    }, invalidate),
    reorder: useTrackedMutation(async (v: { setlistId: string; orderedIds: string[] }) => {
      reorderPersistedSetlist(v.setlistId, v.orderedIds)
      try {
        return await endpoints.reorder(v.setlistId, v.orderedIds)
      } catch {
        return { ok: true }
      }
    }, invalidate),
    createSong: useTrackedMutation(async (body: SongInput) => {
      try {
        const created = (await endpoints.createSong(body)) as Song
        rememberSong(created)
        return created
      } catch (err) {
        rememberSong(songFromInput(body))
        throw err
      }
    }, invalidate),
    patchSong: useTrackedMutation(async (v: { id: string; body: SongInput }) => {
      try {
        const updated = (await endpoints.patchSong(v.id, v.body)) as Song
        rememberSong(updated)
        return updated
      } catch (err) {
        const current = findSongInCache(qc, v.id)
        const local = { ...(current ?? { id: v.id }), ...v.body } as Song
        rememberSong(local)
        throw err
      }
    }, invalidate),
    deleteSong: useTrackedMutation(async (id: string) => {
      rememberDeletedSong(id)
      try {
        return await endpoints.deleteSong(id)
      } catch {
        return { ok: true }
      }
    }, invalidate),
    bulkImport: useTrackedMutation(async (text: string) => {
      return await endpoints.bulkImport(text)
    }, invalidate),
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
    }, invalidate),
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
