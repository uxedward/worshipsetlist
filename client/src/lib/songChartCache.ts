import type { Song } from '@shared/types.ts'

const KEY = 'setflow.songChart.v1.'

export function hasSongChart(song?: Song | null) {
  return Boolean(song?.sections?.some((section) => section.lines?.length))
}

function stores(): Array<Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>> {
  const out: Array<Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>> = []
  try {
    if (typeof localStorage !== 'undefined') out.push(localStorage)
  } catch {
    /* private mode */
  }
  try {
    if (typeof sessionStorage !== 'undefined') out.push(sessionStorage)
  } catch {
    /* private mode */
  }
  return out
}

export function readCachedSong(id: string): Song | null {
  for (const store of stores()) {
    try {
      const raw = store.getItem(KEY + id)
      if (!raw) continue
      const parsed = JSON.parse(raw) as Song
      if (parsed?.id === id) return parsed
    } catch {
      /* ignore */
    }
  }
  return null
}

export function writeCachedSong(song: Song) {
  if (!hasSongChart(song)) return
  const raw = JSON.stringify(song)
  for (const store of stores()) {
    try {
      store.setItem(KEY + song.id, raw)
    } catch {
      /* quota / private mode */
    }
  }
}

export function dropCachedSong(id: string) {
  for (const store of stores()) {
    try {
      store.removeItem(KEY + id)
    } catch {
      /* ignore */
    }
  }
}

export function cacheSetlistSongCharts(
  setlists: Array<{ songs?: Array<{ song?: Song | null }> }> | null | undefined,
  onChart?: (song: Song) => void,
) {
  for (const setlist of setlists ?? []) {
    for (const row of setlist.songs ?? []) {
      const song = row.song
      if (!hasSongChart(song) || !song) continue
      writeCachedSong(song)
      onChart?.(song)
    }
  }
}
