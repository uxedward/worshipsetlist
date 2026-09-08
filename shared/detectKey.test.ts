import { describe, expect, it } from 'vitest'
import { parseChart } from './chartParser.ts'
import { detectKeyFromChords, detectKeyFromSections, keyFromChartText, resolveSongKey } from './detectKey.ts'

describe('detectKeyFromChords', () => {
  it('detects Oceans as Bm', () => {
    const { sections } = parseChart(`[Intro]
Bm   A/C#   D   A   G

[Verse 1]
Bm                    A/C#         D
You call me out upon the waters
A                              G
The great unknown where feet may fail

[Chorus]
G              D             A
And I will call upon Your name
G           D             A
And keep my eyes above the waves
A              Bm
For I am Yours`)
    expect(detectKeyFromSections(sections)).toBe('Bm')
  })

  it('detects a D-major worship chorus', () => {
    expect(detectKeyFromChords(['D', 'A', 'Bm', 'G', 'D/F#', 'A', 'Bm', 'G'])).toBe('D')
  })

  it('detects G from a simple G C D loop that starts and ends on G', () => {
    expect(detectKeyFromChords(['G', 'C', 'D', 'G'])).toBe('G')
  })

  it('detects C from Am F C G that cadences on C', () => {
    expect(detectKeyFromChords(['Am', 'F', 'C', 'G', 'C'])).toBe('C')
  })

  it('returns null when there are no chords', () => {
    expect(detectKeyFromChords([])).toBeNull()
    expect(detectKeyFromSections([{ lines: [{ lyric: 'Add lyrics', chords: '' }] }])).toBeNull()
  })
})

describe('resolveSongKey', () => {
  it('keeps an explicit non-C key', () => {
    expect(resolveSongKey('E', [{ lines: [{ chords: 'G C D G' }] }])).toBe('E')
  })

  it('replaces default C when the chart is clearly in another key', () => {
    expect(resolveSongKey('C', [{ lines: [{ chords: 'Bm A D G Bm' }] }])).toBe('Bm')
    expect(resolveSongKey(undefined, [{ lines: [{ chords: 'D A Bm G D' }] }])).toBe('D')
  })

  it('reads a Key line from pasted chart text', () => {
    expect(keyFromChartText('Title: Oceans\nKey: Bm\n\n[Verse]\nBm\nhello')).toBe('Bm')
  })
})
