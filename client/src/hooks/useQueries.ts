import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { endpoints, flushQueue, pingHealth } from '../lib/api.ts'
import { useAppStore } from '../store/useAppStore.ts'
import type { Setlist, SetlistSong, Song, SongInput } from '@shared/types.ts'
import {
  appendSetlistSong,
  overlaySetlist,
  overlaySetlists,
  overlaySong,
  overlaySongs,
  patchPersistedSetlistSong,
  rememberDeletedSetlist,
  rememberDeletedSong,
  rememberSetlist,
  rememberSong,
  removePersistedSetlistSong,
  reorderPersistedSetlist,
} from '../lib/persist.ts'

export function usePreferences() {
  return useQuery({
    queryKey: ['preferences'],
    queryFn: endpoints.prefs,
  })
}

export function useSetlists() {
  return useQuery({
    queryKey: ['setlists'],
    queryFn: async () => overlaySetlists(await endpoints.setlists()),
  })
}

export function useSetlist(id: string | null) {
  return useQuery({
    queryKey: ['setlist', id],
    queryFn: async () => overlaySetlist(await endpoints.setlist(id!)),
    enabled: Boolean(id),
  })
}

export function useSongs(params: { search?: string; artist?: string; tag?: string; sort?: string }) {
  const q = new URLSearchParams()
  if (params.search) q.set('search', params.search)
  if (params.artist) q.set('artist', params.artist)
  if (params.tag) q.set('tag', params.tag)
  if (params.sort) q.set('sort', params.sort)
  const qs = q.toString() ? `?${q.toString()}` : ''
  return useQuery({
    queryKey: ['songs', params],
    queryFn: async () => overlaySongs(await endpoints.songs(qs)),
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
  const listed = qc.getQueryData<Setlist[]>(['setlists'])
  if (listed) {
    qc.setQueryData<Setlist[]>(
      ['setlists'],
      listed.map((s) =>
        s.id === setlistId
          ? { ...s, _count: { songs: (s._count?.songs ?? s.songs?.length ?? 0) + 1 } }
          : s,
      ),
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
    patchPrefs: useTrackedMutation(endpoints.patchPrefs, () => {
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
      const copy = (await endpoints.duplicateSetlist(id)) as Setlist
      rememberSetlist(copy)
      return copy
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
      removePersistedSetlistSong(v.setlistId, v.ssId)
      qc.setQueryData<Setlist>(['setlist', v.setlistId], (prev) => {
        if (!prev?.songs) return prev
        const songs = prev.songs.filter((row) => row.id !== v.ssId)
        const next = { ...prev, songs, _count: { songs: songs.length } }
        rememberSetlist(next)
        return next
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
      } catch {
        const local: Song = {
          id: `local-${crypto.randomUUID()}`,
          title: body.title,
          artist: body.artist,
          album: body.album ?? null,
          key: body.key,
          bpm: body.bpm,
          timeSignature: body.timeSignature ?? '4/4',
          tag: body.tag,
          durationSeconds: body.durationSeconds ?? null,
          createdAt: new Date().toISOString(),
          sections: body.sections.map((s, i) => ({
            id: `local-sec-${i}`,
            songId: '',
            label: s.label,
            order: s.order,
            lines: s.lines.map((l, j) => ({
              id: `local-line-${i}-${j}`,
              sectionId: `local-sec-${i}`,
              chords: l.chords,
              lyric: l.lyric,
              order: l.order,
            })),
          })),
        }
        rememberSong(local)
        return local
      }
    }, invalidate),
    patchSong: useTrackedMutation(async (v: { id: string; body: SongInput }) => {
      try {
        const updated = (await endpoints.patchSong(v.id, v.body)) as Song
        rememberSong(updated)
        return updated
      } catch {
        const current = findSongInCache(qc, v.id)
        const local = { ...(current ?? { id: v.id }), ...v.body } as Song
        rememberSong(local)
        return local
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
    bulkImport: useTrackedMutation(endpoints.bulkImport, invalidate),
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
      setSaveStatus('saved')
      await qc.invalidateQueries()
    } catch {
      setSaveStatus('failed')
    }
  }
}

export type { Song, Setlist, SetlistSong }
