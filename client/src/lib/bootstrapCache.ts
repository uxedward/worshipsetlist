import type { Preference, Setlist, Song } from '@shared/types.ts'

export type BootstrapPayload = {
  preferences: Preference
  setlists: Setlist[]
  songs: Song[]
  activeSetlist: Setlist | null
}

export const BOOTSTRAP_CACHE_KEY = 'setflow.bootstrap.cache.v1'

export function readBootstrapCache(): BootstrapPayload | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(BOOTSTRAP_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as BootstrapPayload
    if (!parsed?.preferences || !Array.isArray(parsed.setlists) || !Array.isArray(parsed.songs)) return null
    return parsed
  } catch {
    return null
  }
}

export function writeBootstrapCache(payload: BootstrapPayload) {
  if (typeof localStorage === 'undefined') return
  try {
    const slim: BootstrapPayload = {
      preferences: payload.preferences,
      setlists: payload.setlists.map((setlist) => ({
        ...setlist,
        songs: setlist.songs?.map((row) => ({
          ...row,
          song: row.song ? { ...row.song, sections: undefined } : row.song,
        })),
      })),
      songs: payload.songs.map((song) => ({ ...song, sections: undefined })),
      activeSetlist: payload.activeSetlist
        ? {
            ...payload.activeSetlist,
            songs: payload.activeSetlist.songs?.map((row) => ({
              ...row,
              song: row.song ? { ...row.song, sections: undefined } : row.song,
            })),
          }
        : null,
    }
    localStorage.setItem(BOOTSTRAP_CACHE_KEY, JSON.stringify(slim))
  } catch {
    /* quota / private mode */
  }
}
