import { describe, expect, it } from 'vitest'
import {
  parseChord,
  transposeChord,
  transposeChordLine,
  transposeKey,
  keyJump,
  preferFlatsForKey,
} from './transpose.ts'

describe('parseChord', () => {
  it('parses simple majors and minors', () => {
    expect(parseChord('G')).toEqual({ root: 'G', accidental: '', quality: '' })
    expect(parseChord('Am')).toEqual({ root: 'A', accidental: '', quality: 'm' })
  })

  it('parses accidentals, extensions, and slash bass', () => {
    expect(parseChord('C#m7')).toMatchObject({
      root: 'C',
      accidental: '#',
      quality: 'm7',
    })
    expect(parseChord('D/F#')).toMatchObject({
      root: 'D',
      accidental: '',
      quality: '',
      bassRoot: 'F',
      bassAccidental: '#',
    })
    expect(parseChord('Gmaj7')).toMatchObject({ quality: 'maj7' })
    expect(parseChord('Asus4')).toMatchObject({ quality: 'sus4' })
  })
})

describe('transposeChord', () => {
  it('shifts G to A by +2', () => {
    expect(transposeChord('G', 2, false)).toBe('A')
  })

  it('shifts Am to Bm', () => {
    expect(transposeChord('Am', 2, false)).toBe('Bm')
  })

  it('shifts C#m7 with quality preserved', () => {
    expect(transposeChord('C#m7', 1, false)).toBe('Dm7')
    expect(transposeChord('C#m7', 2, false)).toBe('D#m7')
  })

  it('shifts slash bass', () => {
    expect(transposeChord('D/F#', 2, false)).toBe('E/G#')
    expect(transposeChord('D/F#', -2, false)).toBe('C/E')
  })

  it('prefers flats when asked', () => {
    expect(transposeChord('A', 1, true)).toBe('Bb')
    expect(transposeChord('A', 1, false)).toBe('A#')
    expect(transposeChord('G', 3, true)).toBe('Bb')
  })

  it('returns original when semitones is 0', () => {
    expect(transposeChord('C#m7', 0, false)).toBe('C#m7')
  })

  it('returns unknown tokens unchanged', () => {
    expect(transposeChord('N.C.', 2, false)).toBe('N.C.')
  })
})

describe('transposeChordLine alignment', () => {
  it('keeps later chords on the same column when the first grows', () => {
    const line = 'G              D'
    const out = transposeChordLine(line, -1, false)
    expect(out.indexOf('F#')).toBe(0)
    expect(out.indexOf('C#')).toBe(line.indexOf('D'))
  })

  it('keeps later chords on the same column when the first shrinks', () => {
    const line = 'F#             D'
    const out = transposeChordLine(line, 1, false)
    expect(out.startsWith('G')).toBe(true)
    expect(out.indexOf('D#') >= 0 ? out.indexOf('D#') : out.indexOf('Eb')).toBe(
      line.indexOf('D'),
    )
  })

  it('pads when a two-character chord becomes three', () => {
    const line = 'Am             C'
    const out = transposeChordLine(line, -1, false)
    expect(out.indexOf('G#m')).toBe(0)
    expect(out.indexOf('B')).toBe(line.indexOf('C'))
  })
})

describe('transposeKey', () => {
  it('uses standard worship spellings', () => {
    expect(transposeKey('D', 1)).toBe('Eb')
    expect(transposeKey('D', 2)).toBe('E')
    expect(transposeKey('C', 1)).toBe('C#')
    expect(transposeKey('F', 0)).toBe('F')
    expect(transposeKey('Am', 2)).toBe('Bm')
    expect(transposeKey('G', 3)).toBe('Bb')
  })

  it('clamps conceptually around the octave', () => {
    expect(transposeKey('C', -1)).toBe('B')
    expect(transposeKey('C', 6)).toBe('F#')
  })
})

describe('keyJump', () => {
  it('is more than 3 semitones from C to E', () => {
    expect(keyJump('C', 'E')).toBe(4)
  })

  it('is 3 from C to Eb', () => {
    expect(keyJump('C', 'Eb')).toBe(3)
  })
})

describe('preferFlatsForKey', () => {
  it('marks common flat keys', () => {
    expect(preferFlatsForKey('F')).toBe(true)
    expect(preferFlatsForKey('Bb')).toBe(true)
    expect(preferFlatsForKey('Dm')).toBe(true)
    expect(preferFlatsForKey('G')).toBe(false)
    expect(preferFlatsForKey('E')).toBe(false)
  })
})
