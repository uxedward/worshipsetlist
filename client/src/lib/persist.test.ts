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
  overlaySetlist,
  overlaySetlists,
  overlaySongs,
  rememberDeletedSetlist,
  rememberSetlist,
  rememberSong,
  rememberSongs,
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

  it('does not copy the server setlist into local storage', () => {
    const sunday = overlaySetlist(
      setlist('a', 'Sunday AM', [row('a', song('s1', 'Oceans')), row('a', song('s2', 'Jireh'), 1)]),
    )
    expect(sunday.songs).toHaveLength(2)

    const emptied = overlaySetlist(setlist('a', 'Sunday AM', []))
    expect(emptied.songs).toHaveLength(0)
  })

  it('keeps an added setlist song after a stale server refetch', () => {
    overlaySetlist(setlist('mw', 'Midweek'))
    appendSetlistSong('mw', row('mw', song('s1', 'Jireh')))
    const stale = overlaySetlist(setlist('mw', 'Midweek'))
    expect(stale.songs).toHaveLength(1)
    expect(stale.songs?.[0].song.title).toBe('Jireh')
  })

  it('merges persisted setlist counts into the sidebar list', () => {
    overlaySetlists([setlist('a', 'Sunday AM'), setlist('b', 'Midweek')])
    appendSetlistSong('b', row('b', song('s1', 'Praise')))
    const listed = overlaySetlists([
      { ...setlist('a', 'Sunday AM'), _count: { songs: 0 } },
      { ...setlist('b', 'Midweek'), _count: { songs: 0 } },
    ])
    expect(listed.find((s) => s.id === 'a')?._count?.songs).toBe(0)
    expect(listed.find((s) => s.id === 'b')?._count?.songs).toBe(1)
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

  it('imports a batch of songs into the library overlay', () => {
    rememberSongs([song('a', 'Oceans'), song('b', 'Jireh')])
    const songs = overlaySongs([song('seed', 'Abba')])
    expect(songs.map((s) => s.title).sort()).toEqual(['Abba', 'Jireh', 'Oceans'])
  })

  it('saves renamed setlists', () => {
    rememberSetlist({ ...setlist('a', 'Sunday AM'), name: 'Sunday Gathering' })
    const listed = overlaySetlists([setlist('a', 'Sunday AM')])
    expect(listed[0].name).toBe('Sunday Gathering')
  })

  it('does not double-count a song already on the server setlist', () => {
    const s1 = song('s1', 'Abba I Know')
    appendSetlistSong('b', row('b', s1))
    const listed = overlaySetlists([
      { ...setlist('b', 'Midweek', [row('b', s1)]), _count: { songs: 1 } },
    ])
    expect(listed[0]._count?.songs).toBe(1)
  })

  it('ignores the old full-setlist snapshot that preloaded Sunday AM', () => {
    localStorage.setItem(
      'setflow.persist.v1',
      JSON.stringify({
        v: 1,
        setlists: {
          a: setlist('a', 'Sunday AM', [
            row('a', song('s1', 'Oceans')),
            row('a', song('s2', 'Jireh'), 1),
          ]),
        },
      }),
    )
    const listed = overlaySetlists([{ ...setlist('a', 'Sunday AM'), _count: { songs: 0 } }])
    expect(listed[0]._count?.songs).toBe(0)
    expect(localStorage.getItem('setflow.persist.v1')).toBeNull()
  })
})
