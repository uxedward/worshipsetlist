import { CHORD_TOKEN } from './transpose.ts'

export interface ParseWarning {
  lineIndex: number
  line: string
  message: string
}

export interface ParsedLine {
  chords: string
  lyric: string
  order: number
}

export interface ParsedSection {
  label: string
  order: number
  lines: ParsedLine[]
}

export interface ParsedChart {
  sections: ParsedSection[]
  warnings: ParseWarning[]
}

const SECTION_RE = /^\[(.+)\]\s*$/

export function isChordToken(token: string): boolean {
  return CHORD_TOKEN.test(token)
}

export function isChordLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  const tokens = trimmed.split(/\s+/)
  return tokens.length > 0 && tokens.every(isChordToken)
}

function looksLikePartialChordLine(line: string): { mixed: boolean; bad?: string } {
  const tokens = line.trim().split(/\s+/).filter(Boolean)
  if (tokens.length < 2) return { mixed: false }
  const chordCount = tokens.filter(isChordToken).length
  if (chordCount === 0 || chordCount === tokens.length) return { mixed: false }
  const bad = tokens.find((t) => !isChordToken(t))
  return { mixed: chordCount >= Math.ceil(tokens.length / 2), bad }
}

export function parseChart(text: string): ParsedChart {
  const rawLines = text.replace(/\r\n/g, '\n').split('\n')
  const sections: ParsedSection[] = []
  const warnings: ParseWarning[] = []
  let current: ParsedSection | null = null
  let pendingChords: string | null = null

  const ensureSection = (label = 'Verse') => {
    if (!current) {
      current = { label, order: sections.length, lines: [] }
      sections.push(current)
    }
    return current
  }

  const pushLine = (chords: string, lyric: string) => {
    const section = ensureSection()
    section.lines.push({
      chords,
      lyric,
      order: section.lines.length,
    })
  }

  const flushPendingChords = () => {
    if (!pendingChords) return
    const section = ensureSection()
    section.lines.push({
      chords: pendingChords,
      lyric: '',
      order: section.lines.length,
    })
    pendingChords = null
  }

  rawLines.forEach((line, lineIndex) => {
    const trimmed = line.trim()

    if (trimmed.startsWith('[') && !SECTION_RE.test(line.trimEnd())) {
      warnings.push({
        lineIndex,
        line,
        message: 'Section header must be [Name] on its own line.',
      })
    }

    const sectionMatch = trimmed.match(SECTION_RE)
    if (sectionMatch) {
      flushPendingChords()
      const label = sectionMatch[1].trim()
      if (!label) {
        warnings.push({ lineIndex, line, message: 'Section header is empty.' })
      }
      current = { label: label || 'Section', order: sections.length, lines: [] }
      sections.push(current)
      return
    }

    if (trimmed === '') {
      flushPendingChords()
      return
    }

    if (isChordLine(line)) {
      pendingChords = line.trimEnd()
      return
    }

    const partial = looksLikePartialChordLine(line)
    if (partial.mixed) {
      warnings.push({
        lineIndex,
        line,
        message: `"${partial.bad}" is not a valid chord. Chord lines must contain only chord names.`,
      })
    }

    const chords = pendingChords ?? ''
    pendingChords = null
    pushLine(chords, line.trimEnd())
  })

  if (pendingChords) {
    warnings.push({
      lineIndex: rawLines.length - 1,
      line: pendingChords,
      message: 'Chord line has no lyric beneath it.',
    })
    flushPendingChords()
  }

  return { sections, warnings }
}

export function chartToText(sections: { label: string; lines: { chords: string; lyric: string }[] }[]): string {
  return sections
    .map((section, i) => {
      const header = `[${section.label}]`
      const body = section.lines
        .map((ln) => {
          if (ln.chords && ln.chords.trim()) {
            return `${ln.chords}\n${ln.lyric}`
          }
          return ln.lyric
        })
        .join('\n')
      const block = body ? `${header}\n${body}` : header
      return i < sections.length - 1 ? block + '\n' : block
    })
    .join('\n')
}

export function hasValidChart(sections: ParsedSection[]): boolean {
  return sections.some((s) => s.lines.some((l) => l.lyric.trim().length > 0))
}
