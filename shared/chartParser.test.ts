import { describe, expect, it } from 'vitest'
import { parseChart, chartToText, isChordLine, hasValidChart, matchSectionHeader, structureSections } from './chartParser.ts'
import { parseBulkImport, serializeExport, parseBulkBlock, displaySongMeta, displayKey } from './bulkFormat.ts'
import type { Song } from './types.ts'

describe('isChordLine', () => {
  it('accepts slash chords and sevenths from Oceans and Beautiful Name', () => {
    expect(isChordLine('Bm   A/C#   D   A   G')).toBe(true)
    expect(isChordLine('D/F#                           A')).toBe(true)
    expect(isChordLine('Bm7                           F#m7')).toBe(true)
    expect(isChordLine('Bm7       A           G')).toBe(true)
  })

  it('rejects lyrics and mixed lines', () => {
    expect(isChordLine('Your lyric line here')).toBe(false)
    expect(isChordLine('G  Your lyric')).toBe(false)
    expect(isChordLine('')).toBe(false)
  })
})

describe('parseChart', () => {
  it('parses section headers and chord/lyric pairs', () => {
    const text = `[Verse 1]
G              D
Your lyric line here
Em             C
Next lyric line`

    const { sections, warnings } = parseChart(text)
    expect(warnings).toEqual([])
    expect(sections).toHaveLength(1)
    expect(sections[0].label).toBe('Verse 1')
    expect(sections[0].lines).toHaveLength(2)
    expect(sections[0].lines[0].chords).toBe('G              D')
    expect(sections[0].lines[0].lyric).toBe('Your lyric line here')
    expect(sections[0].lines[1].chords).toBe('Em             C')
    expect(sections[0].lines[1].lyric).toBe('Next lyric line')
  })

  it('pairs lyrics with empty chords when none sit above', () => {
    const { sections } = parseChart(`[Chorus]
Just a lyric`)
    expect(sections[0].lines[0]).toMatchObject({ chords: '', lyric: 'Just a lyric' })
  })

  it('keeps chord-only lines when a blank follows, and does not attach them to later lyrics', () => {
    const text = `[Intro]
G              D

Orphan lyric`
    const { sections } = parseChart(text)
    expect(sections[0].lines).toHaveLength(2)
    expect(sections[0].lines[0].chords).toBe('G              D')
    expect(sections[0].lines[0].lyric).toBe('')
    expect(sections[0].lines[1].chords).toBe('')
    expect(sections[0].lines[1].lyric).toBe('Orphan lyric')
  })

  it('parses the Beautiful Name closing chorus exactly', () => {
    const { sections } = parseChart(`[Chorus 3]
D                              A
What a powerful Name it is what a powerful Name it is
Bm        A           G
The Name of Jesus Christ my King
D/F#                           A
What a powerful Name it is nothing can stand against
Bm7       A           G
What a powerful Name it is the Name of Jesus
Bm7       A           G
What a powerful Name it is the Name of Jesus
Bm7       A           G
What a powerful Name it is the Name of Jesus`)
    expect(sections[0].label).toBe('Chorus 3')
    expect(sections[0].lines.map((l) => l.lyric)).toEqual([
      'What a powerful Name it is what a powerful Name it is',
      'The Name of Jesus Christ my King',
      'What a powerful Name it is nothing can stand against',
      'What a powerful Name it is the Name of Jesus',
      'What a powerful Name it is the Name of Jesus',
      'What a powerful Name it is the Name of Jesus',
    ])
    expect(sections[0].lines[0].chords).toBe('D                              A')
    expect(sections[0].lines[2].chords).toBe('D/F#                           A')
    expect(sections[0].lines[3].chords).toBe('Bm7       A           G')
  })

  it('keeps intro chords with no lyric line', () => {
    const { sections } = parseChart(`[Intro]
Bm   A/C#   D   A   G

[Verse 1]
Bm                    A/C#         D
You call me out upon the waters`)
    expect(sections[0].label).toBe('Intro')
    expect(sections[0].lines).toHaveLength(1)
    expect(sections[0].lines[0].chords).toBe('Bm   A/C#   D   A   G')
    expect(sections[0].lines[0].lyric).toBe('')
    expect(sections[1].lines[0].lyric).toBe('You call me out upon the waters')
  })

  it('preserves internal chord spacing', () => {
    const spaced = 'C     G     Am    F'
    const { sections } = parseChart(`[V]\n${spaced}\nwords`)
    expect(sections[0].lines[0].chords).toBe(spaced)
  })

  it('warns on mixed chord/lyric tokens', () => {
    const { warnings } = parseChart(`[V]
G  hello  D
lyric`)
    expect(warnings.some((w) => w.message.includes('not a valid chord'))).toBe(true)
  })

  it('warns on unclosed section brackets', () => {
    const { warnings } = parseChart(`[Verse 1`)
    expect(warnings.some((w) => w.message.includes('Section header'))).toBe(true)
  })

  it('increments section order', () => {
    const { sections } = parseChart(`[Verse]
C
a
[Chorus]
G
b`)
    expect(sections.map((s) => s.order)).toEqual([0, 1])
    expect(sections.map((s) => s.label)).toEqual(['Verse', 'Chorus'])
  })

  it('round-trips through chartToText', () => {
    const text = `[Verse 1]
G              D
Your lyric line here
Em             C
Next lyric line
[Chorus]
C     G
Sing it`
    const parsed = parseChart(text)
    const rebuilt = chartToText(parsed.sections)
    const again = parseChart(rebuilt)
    expect(again.sections[0].lines[0].chords).toBe(parsed.sections[0].lines[0].chords)
    expect(again.sections[1].label).toBe('Chorus')
  })

  it('hasValidChart requires a lyric line', () => {
    expect(hasValidChart([])).toBe(false)
    expect(hasValidChart(parseChart('[V]\nG').sections)).toBe(false)
    expect(hasValidChart(parseChart('[V]\nG\nlyric').sections)).toBe(true)
  })

  it('detects unbracketed Verse / Reff / Bridge headers', () => {
    const text = `Verse 1
You call me out upon the waters
The great unknown where feet may fail

Reff
Spirit lead me where my trust is without borders
Let me walk upon the waters

Bait 2
In oceans deep my faith will stand

Bridge
Spirit lead me
Where my trust is without borders`
    const { sections } = parseChart(text)
    expect(sections.map((s) => s.label)).toEqual(['Verse 1', 'Reff', 'Verse 2', 'Bridge'])
    expect(sections[0].lines[0].lyric).toBe('You call me out upon the waters')
    expect(sections[1].lines[0].lyric).toBe('Spirit lead me where my trust is without borders')
    expect(sections[2].lines[0].lyric).toBe('In oceans deep my faith will stand')
  })

  it('detects Chorus: and (Intro) headers and leaves chord C alone', () => {
    const text = `(Intro)
G     D

Chorus:
This is the chorus line
C
And this lyric sits under C`
    const { sections } = parseChart(text)
    expect(sections.map((s) => s.label)).toEqual(['Intro', 'Chorus'])
    expect(sections[1].lines[1]).toMatchObject({ chords: 'C', lyric: 'And this lyric sits under C' })
  })

  it('does not treat a lyric containing the word chorus as a header', () => {
    const { sections } = parseChart(`[Verse]
The chorus of angels sing
Over the earth`)
    expect(sections).toHaveLength(1)
    expect(sections[0].lines[0].lyric).toBe('The chorus of angels sing')
  })

  it('labels repeated unlabeled stanzas as Reff', () => {
    const text = `You call me out upon the waters
The great unknown where feet may fail

Spirit lead me where my trust is without borders
Let me walk upon the waters

In oceans deep my faith will stand
I will call upon Your name

Spirit lead me where my trust is without borders
Let me walk upon the waters`
    const { sections } = parseChart(text)
    expect(sections.map((s) => s.label)).toEqual(['Verse 1', 'Reff', 'Verse 2', 'Reff'])
    expect(sections[1].lines.map((l) => l.lyric)).toEqual(sections[3].lines.map((l) => l.lyric))
  })

  it('re-splits a saved one-section paste for present mode', () => {
    const blob = [
      {
        label: 'Verse',
        lines: [
          { chords: '', lyric: 'Verse 1' },
          { chords: '', lyric: 'You call me out upon the waters' },
          { chords: '', lyric: 'Reff' },
          { chords: '', lyric: 'Spirit lead me where my trust is without borders' },
        ],
      },
    ]
    expect(structureSections(blob).map((s) => s.label)).toEqual(['Verse 1', 'Reff'])
  })
})

describe('matchSectionHeader', () => {
  it('recognizes common worship labels', () => {
    expect(matchSectionHeader('[Verse 1]')).toBe('Verse 1')
    expect(matchSectionHeader('Reff:')).toBe('Reff')
    expect(matchSectionHeader('Bait 2')).toBe('Verse 2')
    expect(matchSectionHeader('V1')).toBe('Verse 1')
    expect(matchSectionHeader('C')).toBeNull()
    expect(matchSectionHeader('[C]')).toBe('Chorus')
  })
})

describe('bulk import/export', () => {
  it('parses === blocks and skips missing title', () => {
    const text = `===
Title: Holy Holy
Artist: Someone
Key: G
BPM: 72
Tag: Worship

[Verse 1]
G              D
Lyric line here
===
Artist: No Title
Key: C
===
Title: Has Title
Artist: Band
Key: D
BPM: 80
Tag: Praise

[Chorus]
D
We sing
===`

    const blocks = parseBulkImport(text)
    expect(blocks).toHaveLength(3)
    expect(blocks[0].input?.title).toBe('Holy Holy')
    expect(blocks[1].skipReason).toMatch(/title/)
    expect(blocks[2].input?.title).toBe('Has Title')
  })

  it('round-trips a song through serializeExport', () => {
    const song: Song = {
      id: '1',
      title: 'Holy Holy',
      artist: 'Someone',
      album: null,
      key: 'G',
      bpm: 72,
      timeSignature: '4/4',
      tag: 'Worship',
      durationSeconds: 240,
      createdAt: new Date().toISOString(),
      sections: [
        {
          id: 's1',
          songId: '1',
          label: 'Verse 1',
          order: 0,
          lines: [
            {
              id: 'l1',
              sectionId: 's1',
              chords: 'G              D',
              lyric: 'Lyric line here',
              order: 0,
            },
          ],
        },
      ],
    }
    const exported = serializeExport([song])
    const blocks = parseBulkImport(exported)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].input?.title).toBe('Holy Holy')
    expect(blocks[0].input?.artist).toBe('Someone')
    expect(blocks[0].input?.bpm).toBe(72)
    expect(blocks[0].input?.sections[0].lines[0].chords).toBe('G              D')
    expect(blocks[0].input?.sections[0].lines[0].lyric).toBe('Lyric line here')
  })

  it('skips a block with no artist', () => {
    const result = parseBulkBlock('Title: Only Title\nKey: C')
    expect(result.skipReason).toMatch(/artist/)
    expect(result.input).toBeNull()
  })

  it('detects the key from chords when Key is omitted', () => {
    const result = parseBulkBlock(`Title: Oceans
Artist: Hillsong United

[Intro]
Bm   A/C#   D   A   G
[Chorus]
G              D             A
And I will call upon Your name
A              Bm
For I am Yours`)
    expect(result.input?.key).toBe('Bm')
  })

  it('unpacks a packed Key | BPM | Tag line', () => {
    const result = parseBulkBlock(`Title: Oceans (Where Feet May Fail)
Artist: Hillsong United
Key: Bm | BPM: 71 | Tag: Worship

[Intro]
Bm   A/C#   D   A   G
`)
    expect(result.input?.key).toBe('Bm')
    expect(result.input?.bpm).toBe(71)
    expect(result.input?.tag).toBe('Worship')
  })

  it('displaySongMeta repairs songs already saved with a packed key', () => {
    expect(displayKey('Bm | BPM: 71 | Tag: Worship')).toBe('Bm')
    expect(displaySongMeta({ key: 'Bm | BPM: 71 | Tag: Worship', bpm: 80, tag: 'Worship' })).toEqual({
      key: 'Bm',
      bpm: 71,
      tag: 'Worship',
    })
  })
})
