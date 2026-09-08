import { describe, expect, it } from 'vitest'
import { displaySections, firstSlideIndexForSection, slidesFromSections } from './presentationSlides.ts'

describe('slidesFromSections', () => {
  it('chunks lyric lines into groups of four', () => {
    const slides = slidesFromSections([
      {
        label: 'Chorus',
        lines: [
          { lyric: 'one' },
          { lyric: 'two' },
          { lyric: 'three' },
          { lyric: 'four' },
          { lyric: 'five' },
          { lyric: 'six' },
        ],
      },
    ])
    expect(slides).toHaveLength(2)
    expect(slides[0].lines).toEqual(['one', 'two', 'three', 'four'])
    expect(slides[1].lines).toEqual(['five', 'six'])
    expect(slides[0].sectionLabel).toBe('Chorus')
  })

  it('never puts more than four lyric lines on a slide', () => {
    const slides = slidesFromSections([
      {
        label: 'Bridge',
        lines: Array.from({ length: 11 }, (_, i) => ({ lyric: `line ${i + 1}` })),
      },
    ])
    expect(slides).toHaveLength(3)
    expect(slides.every((s) => s.lines.length <= 4)).toBe(true)
    expect(slides[0].lines).toHaveLength(4)
    expect(slides[2].lines).toHaveLength(3)
  })

  it('skips chord-only sections and blank lines', () => {
    const slides = slidesFromSections([
      { label: 'Intro', lines: [{ lyric: '' }, { lyric: '   ' }] },
      { label: 'Verse 1', lines: [{ lyric: 'You call me out' }, { lyric: '' }, { lyric: 'upon the waters' }] },
    ])
    expect(slides).toHaveLength(1)
    expect(slides[0].sectionIndex).toBe(1)
    expect(slides[0].lines).toEqual(['You call me out', 'upon the waters'])
  })

  it('finds the first slide of a section', () => {
    const slides = slidesFromSections([
      { label: 'V', lines: [{ lyric: 'a' }, { lyric: 'b' }, { lyric: 'c' }, { lyric: 'd' }, { lyric: 'e' }] },
      { label: 'C', lines: [{ lyric: 'chorus' }] },
    ])
    expect(firstSlideIndexForSection(slides, 0)).toBe(0)
    expect(firstSlideIndexForSection(slides, 1)).toBe(2)
  })

  it('splits a pasted blob into Verse and Reff for present mode', () => {
    const sections = displaySections([
      {
        id: 'one',
        songId: 's1',
        label: 'Verse',
        order: 0,
        lines: [
          { id: 'a', sectionId: 'one', chords: '', lyric: 'Verse 1', order: 0 },
          { id: 'b', sectionId: 'one', chords: '', lyric: 'You call me out upon the waters', order: 1 },
          { id: 'c', sectionId: 'one', chords: '', lyric: 'Reff', order: 2 },
          { id: 'd', sectionId: 'one', chords: '', lyric: 'Spirit lead me where my trust is without borders', order: 3 },
        ],
      },
    ])
    expect(sections.map((s) => s.label)).toEqual(['Verse 1', 'Reff'])
    const slides = slidesFromSections(sections)
    expect(slides[0].sectionLabel).toBe('Verse 1')
    expect(slides[1].sectionLabel).toBe('Reff')
  })
})
