import { describe, expect, it, beforeEach } from 'vitest'
import { BOOTSTRAP_CACHE_KEY, readBootstrapCache, writeBootstrapCache } from './bootstrapCache.ts'
import type { BootstrapPayload } from './bootstrapCache.ts'

const memory = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value)
    },
    removeItem: (key: string) => {
      memory.delete(key)
    },
    clear: () => memory.clear(),
  },
})

const sample: BootstrapPayload = {
  preferences: { id: 1, theme: 'dark', presentationFontSize: 'medium', lastSetlistId: 's1' },
  setlists: [
    {
      id: 's1',
      name: 'Sunday AM',
      description: null,
      serviceName: 'Morning Worship',
      date: null,
      colorIndex: 0,
      sortOrder: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      _count: { songs: 0 },
    },
  ],
  songs: [
    {
      id: 'song1',
      title: 'Oceans',
      artist: 'Hillsong United',
      album: null,
      key: 'Bm',
      bpm: 66,
      timeSignature: '4/4',
      tag: 'Worship',
      durationSeconds: 420,
      createdAt: '2026-01-01T00:00:00.000Z',
      sections: [{ id: 'sec', songId: 'song1', label: 'Verse', order: 0, lines: [] }],
    },
  ],
  activeSetlist: null,
}

describe('bootstrapCache', () => {
  beforeEach(() => memory.clear())

  it('stores metadata without chord charts so the next visit can paint immediately', () => {
    writeBootstrapCache(sample)
    const cached = readBootstrapCache()
    expect(cached?.songs[0].title).toBe('Oceans')
    expect(cached?.songs[0].key).toBe('Bm')
    expect(cached?.songs[0].sections).toBeUndefined()
    expect(JSON.parse(memory.get(BOOTSTRAP_CACHE_KEY)!).songs[0].sections).toBeUndefined()
  })

  it('returns null for junk', () => {
    memory.set(BOOTSTRAP_CACHE_KEY, '{not json')
    expect(readBootstrapCache()).toBeNull()
  })
})
