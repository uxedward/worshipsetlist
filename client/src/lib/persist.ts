import type { Setlist, SetlistSong, Song } from '@shared/types.ts'

const KEY = 'setflow.persist.v1'

export type PersistState = {
  v: 1
  setlists: Record<string, Setlist>
  deletedSetlistIds: string[]
  extraSongs: Record<string, Song>
  deletedSongIds: string[]
}

function empty(): PersistState {
  return { v: 1, setlists: {}, deletedSetlistIds: [], extraSongs: {}, deletedSongIds: [] }
}

export function loadPersist(): PersistState {
  if (typeof localStorage === 'undefined') return empty()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty()
    const parsed = JSON.parse(raw) as PersistState
    if (parsed?.v !== 1) return empty()
    return {
      v: 1,
      setlists: parsed.setlists ?? {},
      deletedSetlistIds: parsed.deletedSetlistIds ?? [],
      extraSongs: parsed.extraSongs ?? {},
      deletedSongIds: parsed.deletedSongIds ?? [],
    }
  } catch {
    return empty()
  }
}

export function savePersist(state: PersistState) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(state))
}

function write(patch: (state: PersistState) => void) {
  const state = loadPersist()
  patch(state)
  savePersist(state)
  return state
}

export function rememberSetlist(setlist: Setlist) {
  write((state) => {
    state.deletedSetlistIds = state.deletedSetlistIds.filter((id) => id !== setlist.id)
    state.setlists[setlist.id] = setlist
  })
}

export function rememberDeletedSetlist(id: string) {
  write((state) => {
    delete state.setlists[id]
    if (!state.deletedSetlistIds.includes(id)) state.deletedSetlistIds.push(id)
  })
}

export function rememberSong(song: Song) {
  write((state) => {
    state.deletedSongIds = state.deletedSongIds.filter((id) => id !== song.id)
    state.extraSongs[song.id] = song
  })
}

export function rememberDeletedSong(id: string) {
  write((state) => {
    delete state.extraSongs[id]
    if (!state.deletedSongIds.includes(id)) state.deletedSongIds.push(id)
    for (const setlist of Object.values(state.setlists)) {
      if (!setlist.songs) continue
      setlist.songs = setlist.songs.filter((row) => row.songId !== id)
    }
  })
}

export function overlaySetlist(server: Setlist): Setlist {
  const state = loadPersist()
  const local = state.setlists[server.id]
  if (local?.songs) {
    return { ...server, ...local, songs: local.songs }
  }
  rememberSetlist(server)
  return server
}

export function overlaySetlists(server: Setlist[]): Setlist[] {
  const state = loadPersist()
  const byId = new Map(server.map((s) => [s.id, s]))
  for (const row of server) {
    if (!state.setlists[row.id] && !state.deletedSetlistIds.includes(row.id)) {
      state.setlists[row.id] = row
    }
  }
  savePersist(state)

  const ids = new Set<string>([
    ...server.map((s) => s.id),
    ...Object.keys(state.setlists),
  ])
  const out: Setlist[] = []
  for (const id of ids) {
    if (state.deletedSetlistIds.includes(id)) continue
    const local = state.setlists[id]
    const remote = byId.get(id)
    const base = local ?? remote
    if (!base) continue
    const count = local?.songs?.length ?? remote?._count?.songs ?? remote?.songs?.length ?? 0
    out.push({ ...base, _count: { songs: count } })
  }
  out.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return out
}

export function overlaySongs(server: Song[]): Song[] {
  const state = loadPersist()
  const byId = new Map(server.map((s) => [s.id, s]))
  for (const song of Object.values(state.extraSongs)) {
    byId.set(song.id, song)
  }
  for (const id of state.deletedSongIds) byId.delete(id)
  return Array.from(byId.values())
}

export function overlaySong(id: string, server: Song | null): Song | null {
  const state = loadPersist()
  if (state.deletedSongIds.includes(id)) return null
  return state.extraSongs[id] ?? server
}

export function appendSetlistSong(setlistId: string, row: SetlistSong) {
  write((state) => {
    const current = state.setlists[setlistId]
    if (!current) {
      state.setlists[setlistId] = {
        id: setlistId,
        name: 'Setlist',
        description: null,
        serviceName: null,
        date: null,
        colorIndex: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        songs: [row],
      }
      return
    }
    const songs = current.songs ?? []
    if (songs.some((s) => s.id === row.id || s.songId === row.songId)) {
      current.songs = songs
      return
    }
    current.songs = [...songs, row]
    current.updatedAt = new Date().toISOString()
  })
}

export function removePersistedSetlistSong(setlistId: string, ssId: string) {
  write((state) => {
    const current = state.setlists[setlistId]
    if (!current?.songs) return
    current.songs = current.songs.filter((row) => row.id !== ssId)
    current.updatedAt = new Date().toISOString()
  })
}

export function patchPersistedSetlistSong(
  setlistId: string,
  ssId: string,
  patch: Partial<Pick<SetlistSong, 'transposedKey' | 'notes' | 'order'>>,
) {
  write((state) => {
    const current = state.setlists[setlistId]
    if (!current?.songs) return
    current.songs = current.songs.map((row) => (row.id === ssId ? { ...row, ...patch } : row))
    current.updatedAt = new Date().toISOString()
  })
}

export function reorderPersistedSetlist(setlistId: string, orderedIds: string[]) {
  write((state) => {
    const current = state.setlists[setlistId]
    if (!current?.songs) return
    const byId = new Map(current.songs.map((row) => [row.id, row]))
    current.songs = orderedIds
      .map((id, order) => {
        const row = byId.get(id)
        return row ? { ...row, order } : null
      })
      .filter((row): row is SetlistSong => Boolean(row))
    current.updatedAt = new Date().toISOString()
  })
}
