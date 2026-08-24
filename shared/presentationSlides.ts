export const LYRICS_PER_SLIDE = 4

export interface LyricSlide {
  sectionIndex: number
  sectionLabel: string
  lines: string[]
}

export function slidesFromSections(
  sections: { label: string; lines: { lyric: string }[] }[],
): LyricSlide[] {
  const slides: LyricSlide[] = []
  sections.forEach((section, sectionIndex) => {
    const lyrics = section.lines.map((l) => l.lyric.trim()).filter(Boolean)
    if (lyrics.length === 0) return
    for (let i = 0; i < lyrics.length; i += LYRICS_PER_SLIDE) {
      slides.push({
        sectionIndex,
        sectionLabel: section.label,
        lines: lyrics.slice(i, i + LYRICS_PER_SLIDE),
      })
    }
  })
  return slides
}

export function firstSlideIndexForSection(slides: LyricSlide[], sectionIndex: number): number {
  const i = slides.findIndex((s) => s.sectionIndex === sectionIndex)
  return i < 0 ? 0 : i
}
