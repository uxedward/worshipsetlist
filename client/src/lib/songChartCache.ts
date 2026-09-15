import type { Song } from '@shared/types.ts'

const KEY = 'setflow.songChart.v1.'

export function hasSongChart(song?: Song | null) {
  return Boolean(song?.sections?.some((section) => section.lines?.length))
}

export function readCachedSong(id: string): Song | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(KEY + id)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Song
    return parsed?.id === id ? parsed : null
  } catch {
    return null
  }
}

export function writeCachedSong(song: Song) {
  if (typeof sessionStorage === 'undefined' || !hasSongChart(song)) return
  try {
    sessionStorage.setItem(KEY + song.id, JSON.stringify(song))
  } catch {
    /* quota / private mode */
  }
}

export function dropCachedSong(id: string) {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(KEY + id)
  } catch {
    /* ignore */
  }
}
