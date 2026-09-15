import { describe, expect, it } from 'vitest'
import { dropCachedSong, hasSongChart, readCachedSong, writeCachedSong } from './songChartCache.ts'
import type { Song } from '@shared/types.ts'

const memory = new Map<string, string>()
Object.defineProperty(globalThis, 'sessionStorage', {
  value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value)
    },
    removeItem: (key: string) => {
      memory.delete(key)
    },
  },
  configurable: true,
})

const song = {
  id: 'song-1',
  title: 'Oceans',
  artist: 'Hillsong',
  key: 'D',
  bpm: 67,
  timeSignature: '4/4',
  tag: 'Worship',
  sections: [{ id: 's1', songId: 'song-1', label: 'V1', order: 0, lines: [{ id: 'l1', sectionId: 's1', chords: 'D', lyric: 'You call me out', order: 0 }] }],
} as Song

describe('song chart cache', () => {
  it('round-trips a full chart and ignores metadata-only songs', () => {
    writeCachedSong({ ...song, sections: [] })
    expect(readCachedSong('song-1')).toBeNull()
    writeCachedSong(song)
    expect(hasSongChart(readCachedSong('song-1'))).toBe(true)
    expect(readCachedSong('song-1')?.title).toBe('Oceans')
    dropCachedSong('song-1')
    expect(readCachedSong('song-1')).toBeNull()
  })
})
