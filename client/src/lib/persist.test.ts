import { describe, expect, it, beforeEach } from 'vitest'

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
import {
  appendSetlistSong,
  loadPersist,
  overlaySetlist,
  overlaySetlists,
  overlaySongs,
  rememberDeletedSetlist,
  rememberSetlist,
  rememberSong,
} from './persist.ts'
import type { Setlist, SetlistSong, Song } from '@shared/types.ts'

const song = (id: string, title: string): Song => ({
  id,
  title,
  artist: 'Test',
  album: null,
  key: 'G',
  bpm: 80,
  timeSignature: '4/4',
  tag: 'Worship',
  durationSeconds: 120,
  createdAt: '2026-01-01T00:00:00.000Z',
})

const setlist = (id: string, name: string, songs: SetlistSong[] = []): Setlist => ({
  id,
  name,
  description: null,
  serviceName: null,
  date: null,
  colorIndex: 0,
  createdAt: `2026-01-0${id === 'a' ? '1' : '2'}T00:00:00.000Z`,
  updatedAt: '2026-01-01T00:00:00.000Z',
  songs,
  _count: { songs: songs.length },
})

const row = (setlistId: string, s: Song, order = 0): SetlistSong => ({
  id: `ss-${s.id}`,
  setlistId,
  songId: s.id,
  order,
  transposedKey: null,
  notes: null,
  song: s,
})

describe('persist overlays', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('keeps an added setlist song after a stale server refetch', () => {
    const midweek = setlist('mw', 'Midweek')
    overlaySetlist(midweek)
    const added = song('s1', 'Jireh')
    appendSetlistSong('mw', row('mw', added))

    const stale = overlaySetlist(setlist('mw', 'Midweek'))
    expect(stale.songs).toHaveLength(1)
    expect(stale.songs?.[0].song.title).toBe('Jireh')
  })

  it('merges persisted setlist counts into the sidebar list', () => {
    overlaySetlists([setlist('a', 'Sunday AM'), setlist('b', 'Midweek')])
    appendSetlistSong('b', row('b', song('s1', 'Praise')))
    const listed = overlaySetlists([
      { ...setlist('a', 'Sunday AM'), _count: { songs: 47 } },
      { ...setlist('b', 'Midweek'), _count: { songs: 0 } },
    ])
    const midweek = listed.find((s) => s.id === 'b')
    expect(midweek?._count?.songs).toBe(1)
  })

  it('remembers a deleted setlist', () => {
    overlaySetlists([setlist('a', 'Sunday AM'), setlist('b', 'Easter')])
    rememberDeletedSetlist('b')
    const listed = overlaySetlists([setlist('a', 'Sunday AM'), setlist('b', 'Easter')])
    expect(listed.map((s) => s.name)).toEqual(['Sunday AM'])
  })

  it('keeps a locally created song in the library overlay', () => {
    rememberSong(song('new', 'Original'))
    const songs = overlaySongs([song('seed', 'Oceans')])
    expect(songs.map((s) => s.title).sort()).toEqual(['Oceans', 'Original'])
  })

  it('does not replace a loaded setlist with a sidebar row that has no songs', () => {
    overlaySetlists([{ ...setlist('a', 'Sunday AM'), songs: undefined, _count: { songs: 47 } }])
    const detail = overlaySetlist({
      ...setlist('a', 'Sunday AM'),
      songs: [row('a', song('s1', 'Oceans'))],
    })
    expect(detail.songs).toHaveLength(1)
    expect(detail.songs?.[0].song.title).toBe('Oceans')
  })

  it('saves renamed setlists', () => {
    rememberSetlist({ ...setlist('a', 'Sunday AM'), name: 'Sunday Gathering' })
    expect(loadPersist().setlists.a.name).toBe('Sunday Gathering')
  })
})
