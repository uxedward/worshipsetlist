import { FLAT_KEYS } from './types'

/** Longest-first so "maj" is not eaten by "m". */
export const CHORD_TOKEN =
  /^[A-G][#b]?(maj|min|dim|aug|sus|add|m|11|13|2|4|5|6|7|9)*(\/[A-G][#b]?)?$/

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

const ENHARMONIC: Record<string, number> = {
  C: 0,
  'B#': 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  'E#': 5,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
  Cb: 11,
}

export function preferFlatsForKey(key: string): boolean {
  return FLAT_KEYS.has(key)
}

export function noteIndex(note: string): number {
  const idx = ENHARMONIC[note]
  if (idx === undefined) {
    throw new Error(`Unknown note: ${note}`)
  }
  return idx
}

export function pitchFromIndex(index: number, preferFlats: boolean): string {
  const i = ((index % 12) + 12) % 12
  return preferFlats ? FLATS[i] : SHARPS[i]
}

export interface ParsedChord {
  root: string
  accidental: string
  quality: string
  bassRoot?: string
  bassAccidental?: string
}

export function parseChord(chord: string): ParsedChord | null {
  const trimmed = chord.trim()
  const m = trimmed.match(/^([A-G])([#b])?(.*?)(?:\/([A-G])([#b])?)?$/)
  if (!m) return null
  const quality = m[3] ?? ''
  if (!CHORD_TOKEN.test(trimmed)) return null
  return {
    root: m[1],
    accidental: m[2] ?? '',
    quality,
    bassRoot: m[4],
    bassAccidental: m[5],
  }
}

function shiftNote(root: string, accidental: string, semitones: number, preferFlats: boolean): string {
  const from = root + accidental
  const idx = noteIndex(from) + semitones
  return pitchFromIndex(idx, preferFlats)
}

export function transposeChord(
  chord: string,
  semitones: number,
  preferFlats = false,
): string {
  if (semitones === 0) return chord
  const parsed = parseChord(chord)
  if (!parsed) return chord
  const root = shiftNote(parsed.root, parsed.accidental, semitones, preferFlats)
  let out = root + parsed.quality
  if (parsed.bassRoot) {
    const bass = shiftNote(parsed.bassRoot, parsed.bassAccidental ?? '', semitones, preferFlats)
    out += '/' + bass
  }
  return out
}

/**
 * Transpose every chord token in a line, padding so later chords stay on
 * their original columns when the new names are shorter or longer.
 */
export function transposeChordLine(
  line: string,
  semitones: number,
  preferFlats = false,
): string {
  if (semitones === 0 || !line) return line
  const matches = [...line.matchAll(/\S+/g)]
  if (matches.length === 0) return line
  let out = ''
  let writePos = 0
  for (const match of matches) {
    const start = match.index ?? 0
    const token = match[0]
    const transposed = CHORD_TOKEN.test(token)
      ? transposeChord(token, semitones, preferFlats)
      : token
    const target = Math.max(start, writePos)
    out += ' '.repeat(target - writePos)
    out += transposed
    writePos = target + transposed.length
  }
  return out
}

export function splitKey(key: string): { note: string; minor: boolean } {
  const minor = key.endsWith('m') && !key.endsWith('dim')
  const note = minor ? key.slice(0, -1) : key
  return { note, minor }
}

/** Common worship spellings: C C# D Eb E F F# G Ab A Bb B */
const KEY_SPELLING = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

export function transposeKey(key: string, semitones: number): string {
  const { note, minor } = splitKey(key)
  const idx = (((noteIndex(note) + semitones) % 12) + 12) % 12
  return KEY_SPELLING[idx] + (minor ? 'm' : '')
}

export function semitonesBetweenKeys(fromKey: string, toKey: string): number {
  const a = noteIndex(splitKey(fromKey).note)
  const b = noteIndex(splitKey(toKey).note)
  return ((b - a) % 12 + 12) % 12
}

/** Smallest chromatic distance (0–6). */
export function keyJump(fromKey: string, toKey: string): number {
  const d = semitonesBetweenKeys(fromKey, toKey)
  return Math.min(d, 12 - d)
}

export function soundingKey(songKey: string, transposedKey: string | null | undefined): string {
  return transposedKey || songKey
}

export function semitonesFromKeys(originalKey: string, transposedKey: string): number {
  let d = semitonesBetweenKeys(originalKey, transposedKey)
  if (d > 6) d -= 12
  return d
}
