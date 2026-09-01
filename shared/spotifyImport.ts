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
  return normalizeId(a.title) === normalizeId(b.title) && normalizeId(a.artist) === normalizeId(b.artist)
}

function normalizeId(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}
