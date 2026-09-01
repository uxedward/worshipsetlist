import type { Setlist, SetlistSong, Song } from '@shared/types.ts'

const KEY = 'setflow.persist.v2'
const LEGACY_KEYS = ['setflow.persist.v1']

export type SetlistEdit = {
  added: SetlistSong[]
  removedSongIds: string[]
  meta?: Partial<Pick<Setlist, 'name' | 'description' | 'serviceName' | 'date' | 'colorIndex'>>
}

export type PersistState = {
  v: 2
  edits: Record<string, SetlistEdit>
  extraSetlists: Setlist[]
  deletedSetlistIds: string[]
  extraSongs: Record<string, Song>
  deletedSongIds: string[]
}

function empty(): PersistState {
  return { v: 2, edits: {}, extraSetlists: [], deletedSetlistIds: [], extraSongs: {}, deletedSongIds: [] }
}

function editFor(state: PersistState, id: string): SetlistEdit {
  if (!state.edits[id]) state.edits[id] = { added: [], removedSongIds: [] }
  return state.edits[id]
}

function discardLegacyPersist() {
  if (typeof localStorage === 'undefined') return
  for (const key of LEGACY_KEYS) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore quota / private-mode failures */
    }
  }
}

export function loadPersist(): PersistState {
  if (typeof localStorage === 'undefined') return empty()
  discardLegacyPersist()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty()
    const parsed = JSON.parse(raw) as PersistState
    if (parsed?.v !== 2) return empty()
    return {
      v: 2,
      edits: parsed.edits ?? {},
      extraSetlists: parsed.extraSetlists ?? [],
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
    const edit = editFor(state, setlist.id)
    edit.meta = {
      ...edit.meta,
      name: setlist.name,
      description: setlist.description,
      serviceName: setlist.serviceName,
      date: setlist.date,
      colorIndex: setlist.colorIndex,
    }
    if (setlist.id.startsWith('local-')) {
      state.extraSetlists = [...state.extraSetlists.filter((s) => s.id !== setlist.id), setlist]
    }
  })
}

export function rememberDeletedSetlist(id: string) {
  write((state) => {
    delete state.edits[id]
    state.extraSetlists = state.extraSetlists.filter((s) => s.id !== id)
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
    for (const edit of Object.values(state.edits)) {
      edit.added = edit.added.filter((row) => row.songId !== id)
      if (!edit.removedSongIds.includes(id)) edit.removedSongIds.push(id)
    }
  })
}

export function applyEdits(server: Setlist, edit?: SetlistEdit): SetlistSong[] {
  const base = (server.songs ?? []).filter((row) => !edit?.removedSongIds.includes(row.songId))
  for (const row of edit?.added ?? []) {
    if (!base.some((s) => s.songId === row.songId || s.id === row.id)) base.push(row)
  }
  return base
}

export function overlaySetlist(server: Setlist): Setlist {
  const state = loadPersist()
  const extra = state.extraSetlists.find((s) => s.id === server.id)
  const edit = state.edits[server.id]
  const source = extra ?? server
  const songs = applyEdits(source, edit)
  return { ...source, ...edit?.meta, songs, _count: { songs: songs.length } }
}

export function overlaySetlists(server: Setlist[]): Setlist[] {
  const state = loadPersist()
  const byId = new Map(server.map((s) => [s.id, s]))
  const ids = new Set<string>([...server.map((s) => s.id), ...state.extraSetlists.map((s) => s.id)])
  const out: Setlist[] = []
  for (const id of ids) {
    if (state.deletedSetlistIds.includes(id)) continue
    const remote = byId.get(id)
    const extra = state.extraSetlists.find((s) => s.id === id)
    const base = extra ?? remote
    if (!base) continue
    const edit = state.edits[id]
    const songs = base.songs ? applyEdits(base, edit) : undefined
    const count = songs
      ? songs.length
      : Math.max(
          0,
          (remote?._count?.songs ?? 0) - (edit?.removedSongIds.length ?? 0) + (edit?.added.length ?? 0),
        )
    out.push({ ...base, ...edit?.meta, _count: { songs: count } })
  }
  out.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return out
}

export function overlaySongs(server: Song[]): Song[] {
  const state = loadPersist()
  const byId = new Map(server.map((s) => [s.id, s]))
  for (const song of Object.values(state.extraSongs)) byId.set(song.id, song)
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
    const edit = editFor(state, setlistId)
    edit.removedSongIds = edit.removedSongIds.filter((id) => id !== row.songId)
    if (edit.added.some((s) => s.id === row.id || s.songId === row.songId)) return
    edit.added = [...edit.added, row]
  })
}

export function removePersistedSetlistSong(setlistId: string, ssId: string, songId?: string) {
  write((state) => {
    const edit = editFor(state, setlistId)
    const existing = edit.added.find((row) => row.id === ssId)
    const removedSongId = songId ?? existing?.songId
    edit.added = edit.added.filter((row) => row.id !== ssId && row.songId !== removedSongId)
    if (removedSongId && !edit.removedSongIds.includes(removedSongId)) {
      edit.removedSongIds.push(removedSongId)
    }
  })
}

export function patchPersistedSetlistSong(
  setlistId: string,
  ssId: string,
  patch: Partial<Pick<SetlistSong, 'transposedKey' | 'notes' | 'order'>>,
) {
  write((state) => {
    const edit = editFor(state, setlistId)
    edit.added = edit.added.map((row) => (row.id === ssId ? { ...row, ...patch } : row))
  })
}

export function reorderPersistedSetlist(setlistId: string, orderedIds: string[]) {
  write((state) => {
    const edit = editFor(state, setlistId)
    const byId = new Map(edit.added.map((row) => [row.id, row]))
    edit.added = orderedIds.map((id, order) => {
      const row = byId.get(id)
      return row ? { ...row, order } : null
    }).filter((row): row is SetlistSong => Boolean(row))
  })
}
