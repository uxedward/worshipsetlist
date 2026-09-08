import { CHORD_TOKEN } from './transpose.js'

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

/** Folded alias → display name. Reff/Bait cover Indonesian charts. */
const SECTION_KIND: Record<string, string> = {
  intro: 'Intro',
  verse: 'Verse',
  v: 'Verse',
  bait: 'Verse',
  prechorus: 'Pre-Chorus',
  pre: 'Pre-Chorus',
  chorus: 'Chorus',
  c: 'Chorus',
  reff: 'Reff',
  reffrein: 'Reff',
  refrein: 'Reff',
  refrain: 'Reff',
  ref: 'Reff',
  bridge: 'Bridge',
  br: 'Bridge',
  jembatan: 'Bridge',
  interlude: 'Interlude',
  instrumental: 'Instrumental',
  instru: 'Instrumental',
  tag: 'Tag',
  ending: 'Ending',
  outro: 'Outro',
  coda: 'Coda',
  hook: 'Hook',
  postchorus: 'Post-Chorus',
  turnaround: 'Turnaround',
  vamp: 'Vamp',
  breakdown: 'Breakdown',
  spoken: 'Spoken',
  finalchorus: 'Chorus',
  lastchorus: 'Chorus',
}

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

function foldLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function numberedLabel(kind: string, num?: string): string {
  return num ? `${kind} ${num}` : kind
}

/** Detect [Verse 1], Verse 1, Reff:, Bait 2, (Chorus), V1, etc. */
export function matchSectionHeader(line: string): string | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  const bracket = trimmed.match(SECTION_RE)
  const inner = (bracket ? bracket[1] : trimmed).replace(/[:.\-–—]+$/g, '').trim()
  if (!inner) return bracket ? 'Section' : null

  if (!bracket) {
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) return null
    if (isChordLine(trimmed) || isChordToken(inner)) return null
    if (inner.length > 48) return null
    if (inner.split(/\s+/).length > 4) return null
  }

  const folded = foldLabel(inner)
  const parts = folded.match(/^([a-z]+)(\d+)?$/)
  if (!parts) return bracket ? inner : null
  const kind = SECTION_KIND[parts[1]]
  if (!kind) return bracket ? inner : null
  return numberedLabel(kind, parts[2])
}

function parseBodyLines(
  rawLines: string[],
  warnings: ParseWarning[],
  lineOffset = 0,
): ParsedLine[] {
  const lines: ParsedLine[] = []
  let pendingChords: string | null = null

  const push = (chords: string, lyric: string) => {
    lines.push({ chords, lyric, order: lines.length })
  }

  const flushPending = () => {
    if (!pendingChords) return
    push(pendingChords, '')
    pendingChords = null
  }

  rawLines.forEach((line, i) => {
    const lineIndex = i + lineOffset
    const trimmed = line.trim()
    if (trimmed === '') {
      flushPending()
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
    push(chords, line.trimEnd())
  })

  if (pendingChords) {
    warnings.push({
      lineIndex: lineOffset + rawLines.length - 1,
      line: pendingChords,
      message: 'Chord line has no lyric beneath it.',
    })
    flushPending()
  }

  return lines
}

function lyricFingerprint(lines: ParsedLine[]): string {
  return lines
    .map((l) =>
      l.lyric
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        .replace(/\s+/g, ' '),
    )
    .filter(Boolean)
    .join('|')
}

function splitStanzas(rawLines: string[]): { lines: string[]; offset: number }[] {
  const stanzas: { lines: string[]; offset: number }[] = []
  let current: string[] = []
  let offset = 0
  rawLines.forEach((line, i) => {
    if (line.trim() === '') {
      if (current.length) {
        stanzas.push({ lines: current, offset })
        current = []
      }
      offset = i + 1
      return
    }
    if (current.length === 0) offset = i
    current.push(line)
  })
  if (current.length) stanzas.push({ lines: current, offset })
  return stanzas
}

function clusterUnlabeledStanzas(rawLines: string[], warnings: ParseWarning[]): ParsedSection[] {
  const stanzas = splitStanzas(rawLines)
  if (stanzas.length <= 1) return []

  const parsed = stanzas.map((stanza) => ({
    ...stanza,
    body: parseBodyLines(stanza.lines, warnings, stanza.offset),
  }))
  const keys = parsed.map((s) => lyricFingerprint(s.body))
  const counts = new Map<string, number>()
  for (const key of keys) {
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let chorusKey = ''
  let chorusCount = 1
  for (const [key, count] of counts) {
    if (count > chorusCount || (count === chorusCount && key.length > chorusKey.length)) {
      chorusKey = key
      chorusCount = count
    }
  }
  const hasChorus = chorusCount >= 2

  const sections: ParsedSection[] = []
  let verseN = 0
  const uniqueIndex = new Map<string, number>()

  parsed.forEach((stanza, i) => {
    const key = keys[i]
    const hasLyric = stanza.body.some((l) => l.lyric.trim())
    const hasChords = stanza.body.some((l) => l.chords.trim())
    let label: string
    if (!hasLyric && hasChords) {
      label = sections.length === 0 ? 'Intro' : 'Instrumental'
    } else if (hasChorus && key === chorusKey) {
      label = 'Reff'
    } else if (key && uniqueIndex.has(key)) {
      label = sections[uniqueIndex.get(key)!]?.label ?? `Verse ${++verseN}`
    } else {
      label = `Verse ${++verseN}`
      if (key) uniqueIndex.set(key, sections.length)
    }
    sections.push({
      label,
      order: sections.length,
      lines: stanza.body.map((l, order) => ({ ...l, order })),
    })
  })

  return sections
}

function dropEmptyLeadIn(sections: ParsedSection[]): ParsedSection[] {
  return sections.filter((section, i) => {
    const hasContent = section.lines.some((l) => l.lyric.trim() || l.chords.trim())
    if (hasContent) return true
    return i === 0 && sections.length === 1
  })
}

export function parseChart(text: string): ParsedChart {
  const rawLines = text.replace(/\r\n/g, '\n').split('\n')
  const sections: ParsedSection[] = []
  const warnings: ParseWarning[] = []
  let current: ParsedSection | null = null
  let pendingChords: string | null = null
  let sawHeader = false

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

  const startSection = (label: string) => {
    flushPendingChords()
    sawHeader = true
    current = { label: label || 'Section', order: sections.length, lines: [] }
    sections.push(current)
  }

  rawLines.forEach((line, lineIndex) => {
    const trimmed = line.trim()

    if (trimmed.startsWith('[') && !SECTION_RE.test(line.trimEnd()) && !matchSectionHeader(trimmed)) {
      warnings.push({
        lineIndex,
        line,
        message: 'Section header must be [Name] on its own line.',
      })
    }

    const header = matchSectionHeader(trimmed)
    if (header && (SECTION_RE.test(trimmed) || !isChordLine(trimmed))) {
      startSection(header)
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

  if (!sawHeader) {
    const clustered = clusterUnlabeledStanzas(rawLines, warnings)
    if (clustered.length > 1) {
      return { sections: clustered, warnings }
    }
  }

  return { sections: dropEmptyLeadIn(sections), warnings }
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

/** Re-run detection on a saved chart so present mode can split a pasted blob. */
export function structureSections(
  sections: { label: string; lines: { chords: string; lyric: string }[] }[],
): ParsedSection[] {
  if (sections.length === 0) return []
  const parsed = parseChart(chartToText(sections))
  return parsed.sections.length > 0 ? parsed.sections : sections.map((s, order) => ({
    label: s.label,
    order,
    lines: s.lines.map((l, i) => ({ chords: l.chords, lyric: l.lyric, order: i })),
  }))
}
