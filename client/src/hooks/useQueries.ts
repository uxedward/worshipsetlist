import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { endpoints, flushQueue, pingHealth } from '../lib/api.ts'
import { useAppStore } from '../store/useAppStore.ts'
import type { Setlist, SetlistSong, Song, SongInput } from '@shared/types.ts'

export function usePreferences() {
  return useQuery({
    queryKey: ['preferences'],
    queryFn: endpoints.prefs,
  })
}

export function useSetlists() {
  return useQuery({
    queryKey: ['setlists'],
    queryFn: endpoints.setlists,
  })
}

export function useSetlist(id: string | null) {
  return useQuery({
    queryKey: ['setlist', id],
    queryFn: () => endpoints.setlist(id!),
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
    queryFn: () => endpoints.songs(qs),
  })
}

export function useSong(id: string | null) {
  return useQuery({
    queryKey: ['song', id],
    queryFn: () => endpoints.song(id!),
    enabled: Boolean(id),
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
    createSetlist: useTrackedMutation(endpoints.createSetlist, invalidate),
    patchSetlist: useTrackedMutation(
      (v: { id: string; body: Record<string, unknown> }) => endpoints.patchSetlist(v.id, v.body),
      invalidate,
    ),
    deleteSetlist: useTrackedMutation(endpoints.deleteSetlist, invalidate),
    duplicateSetlist: useTrackedMutation(endpoints.duplicateSetlist, invalidate),
    addSong: useTrackedMutation(
      (v: { setlistId: string; songId: string }) => endpoints.addSongToSetlist(v.setlistId, v.songId),
      invalidate,
    ),
    patchSetlistSong: useTrackedMutation(
      (v: { setlistId: string; ssId: string; body: Record<string, unknown> }) =>
        endpoints.patchSetlistSong(v.setlistId, v.ssId, v.body),
      invalidate,
    ),
    removeSong: useTrackedMutation(
      (v: { setlistId: string; ssId: string }) => endpoints.removeSetlistSong(v.setlistId, v.ssId),
      invalidate,
    ),
    reorder: useTrackedMutation(
      (v: { setlistId: string; orderedIds: string[] }) => endpoints.reorder(v.setlistId, v.orderedIds),
      invalidate,
    ),
    createSong: useTrackedMutation((body: SongInput) => endpoints.createSong(body), invalidate),
    patchSong: useTrackedMutation(
      (v: { id: string; body: SongInput }) => endpoints.patchSong(v.id, v.body),
      invalidate,
    ),
    deleteSong: useTrackedMutation(endpoints.deleteSong, invalidate),
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
