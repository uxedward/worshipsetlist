import type { SongInput } from './types.ts'
import type { SpotifyTrack } from './spotify.ts'

export function songInputFromSpotifyTrack(track: SpotifyTrack): SongInput {
  return {
    title: track.title.trim(),
    artist: track.artist.trim() || 'Unknown Artist',
    album: null,
    key: 'C',
    bpm: 80,
    timeSignature: '4/4',
    tag: 'Worship',
    durationSeconds: track.durationSeconds,
    sections: [
      {
        label: 'Verse',
        order: 0,
        lines: [{ chords: '', lyric: 'Add lyrics', order: 0 }],
      },
    ],
  }
}

export function sameSongIdentity(a: { title: string; artist: string }, b: { title: string; artist: string }): boolean {
  if (normalizeId(a.title) !== normalizeId(b.title)) return false
  const left = billedArtists(a.artist)
  const right = billedArtists(b.artist)
  if (left.length === 0 || right.length === 0) return false
  return left[0] === right[0]
}

function billedArtists(value: string): string[] {
  return value
    .split(',')
    .map((part) => normalizeId(part))
    .filter(Boolean)
}

function normalizeId(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}
