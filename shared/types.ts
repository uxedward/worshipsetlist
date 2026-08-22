export const TAGS = [
  'Opening',
  'Praise',
  'Worship',
  'Communion',
  'Response',
  'Closing',
] as const

export type Tag = (typeof TAGS)[number]

export const TIME_SIGNATURES = ['4/4', '3/4', '6/8', '2/4'] as const
export type TimeSignature = (typeof TIME_SIGNATURES)[number]

export const MAJOR_KEYS = [
  'C',
  'C#',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'F#',
  'Gb',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
] as const

export const MINOR_KEYS = [
  'Cm',
  'C#m',
  'Dbm',
  'Dm',
  'Ebm',
  'Em',
  'Fm',
  'F#m',
  'Gbm',
  'Gm',
  'Abm',
  'Am',
  'Bbm',
  'Bm',
] as const

export const KEYS = [...MAJOR_KEYS, ...MINOR_KEYS] as const
export type MusicalKey = (typeof KEYS)[number]

export const FLAT_KEYS = new Set([
  'F',
  'Bb',
  'Eb',
  'Ab',
  'Db',
  'Gb',
  'Cb',
  'Dm',
  'Gm',
  'Cm',
  'Fm',
  'Bbm',
  'Ebm',
  'Abm',
  'Dbm',
])

export const COLOR_GRADIENTS = [
  ['#8B2E1F', '#3D1008'],
  ['#1E3A5F', '#0B1A2E'],
  ['#1B5E3B', '#0A2A18'],
  ['#4A2870', '#1E0F30'],
  ['#8B5A12', '#3D2708'],
] as const

export const BPM_MIN = 40
export const BPM_MAX = 200
export const TRANSPOSE_MIN = -6
export const TRANSPOSE_MAX = 6
export const DESCRIPTION_MAX = 200

export type Theme = 'dark' | 'light'
export type PresentationFontSize = 'small' | 'medium' | 'large'

export interface Line {
  id: string
  sectionId: string
  chords: string
  lyric: string
  order: number
}

export interface Section {
  id: string
  songId: string
  label: string
  order: number
  lines: Line[]
}

export interface Song {
  id: string
  title: string
  artist: string
  album: string | null
  key: string
  bpm: number
  timeSignature: string
  tag: string
  durationSeconds: number | null
  createdAt: string
  sections?: Section[]
}

export interface SetlistSong {
  id: string
  setlistId: string
  songId: string
  order: number
  transposedKey: string | null
  notes: string | null
  song: Song
}

export interface Setlist {
  id: string
  name: string
  description: string | null
  serviceName: string | null
  date: string | null
  colorIndex: number
  createdAt: string
  updatedAt: string
  songs?: SetlistSong[]
  _count?: { songs: number }
}

export interface Preference {
  id: number
  theme: Theme
  presentationFontSize: PresentationFontSize
  lastSetlistId: string | null
}

export interface SongInput {
  title: string
  artist: string
  album?: string | null
  key: string
  bpm: number
  timeSignature?: string
  tag: string
  durationSeconds?: number | null
  sections: {
    label: string
    order: number
    lines: { chords: string; lyric: string; order: number }[]
  }[]
}
