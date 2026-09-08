import { KEYS, MINOR_KEYS, type MusicalKey } from './types.ts'
import { parseChord, noteIndex } from './transpose.ts'

const MAJOR_SCALE = new Set([0, 2, 4, 5, 7, 9, 11])
const MINOR_SCALE = new Set([0, 2, 3, 5, 7, 8, 10, 11])

type ChordHit = { pc: number; minor: boolean }

function isMinorQuality(quality: string): boolean {
  const q = quality.toLowerCase()
  if (!q || q.startsWith('maj') || q.startsWith('sus') || q.startsWith('dim') || q.startsWith('aug')) return false
  if (q.startsWith('min') || q.startsWith('mi')) return true
  return q.startsWith('m')
}

function parseHit(token: string): ChordHit | null {
  const parsed = parseChord(token)
  if (!parsed) return null
  return {
    pc: noteIndex(parsed.root + parsed.accidental),
    minor: isMinorQuality(parsed.quality),
  }
}

export function chordsFromSections(sections: { lines?: { chords?: string }[] }[] | undefined): string[] {
  if (!sections?.length) return []
  const out: string[] = []
  for (const section of sections) {
    for (const line of section.lines ?? []) {
      for (const token of (line.chords ?? '').trim().split(/\s+/)) {
        if (token && parseChord(token)) out.push(token)
      }
    }
  }
  return out
}

function tonicOf(key: MusicalKey): { pc: number; minor: boolean } {
  const minor = (MINOR_KEYS as readonly string[]).includes(key)
  const root = minor ? key.slice(0, -1) : key
  return { pc: noteIndex(root), minor }
}

function relative(pc: number, tonic: number): number {
  return ((pc - tonic) % 12 + 12) % 12
}

function scoreKey(hits: ChordHit[], key: MusicalKey): number {
  const { pc: tonic, minor } = tonicOf(key)
  const scale = minor ? MINOR_SCALE : MAJOR_SCALE
  let score = 0
  hits.forEach((hit, i) => {
    const deg = relative(hit.pc, tonic)
    score += scale.has(deg) ? 2 : -4
    if (deg === 0) {
      const tonicQuality = hit.minor === minor
      score += tonicQuality ? 5 : 1
      if (tonicQuality && i === 0) score += 8
      if (tonicQuality && i === hits.length - 1) score += 10
    } else if (deg === 7) {
      score += 3
    } else if (deg === 5) {
      score += 2
    } else if (!minor && deg === 9 && hit.minor) {
      score += 1
    } else if (minor && deg === 3 && !hit.minor) {
      score += 1
    }
  })
  const first = hits[0]
  const last = hits[hits.length - 1]
  if (
    first &&
    last &&
    relative(first.pc, tonic) === 0 &&
    relative(last.pc, tonic) === 0 &&
    first.minor === minor &&
    last.minor === minor
  ) {
    score += 8
  }
  return score
}

function preferFlats(tokens: string[]): boolean {
  let flats = 0
  let sharps = 0
  for (const token of tokens) {
    if (token.includes('#')) sharps += 1
    else if (/(?:^|[A-G])b/.test(token)) flats += 1
  }
  return flats > sharps
}

export function detectKeyFromChords(tokens: string[]): MusicalKey | null {
  const hits = tokens.map(parseHit).filter((hit): hit is ChordHit => Boolean(hit))
  if (hits.length === 0) return null

  const flats = preferFlats(tokens)
  const ranked: { key: MusicalKey; score: number }[] = []

  for (const key of KEYS) {
    const usesFlat = key.includes('b')
    const usesSharp = key.includes('#')
    if (flats && usesSharp) continue
    if (!flats && usesFlat && tokens.some((t) => t.includes('#'))) continue
    ranked.push({ key, score: scoreKey(hits, key) })
  }
  ranked.sort((a, b) => b.score - a.score)
  const best = ranked[0]
  if (!best) return null

  const first = hits[0]
  const last = hits[hits.length - 1]
  if (first && last && first.pc === last.pc && first.minor === last.minor) {
    const bookend = ranked.find((row) => {
      const tonic = tonicOf(row.key)
      return tonic.pc === first.pc && tonic.minor === first.minor
    })
    if (bookend) return bookend.key
  }

  return best.key
}

export function detectKeyFromSections(sections: { lines?: { chords?: string }[] }[] | undefined): MusicalKey | null {
  return detectKeyFromChords(chordsFromSections(sections))
}

const KEY_LINE = /(?:^|\n)\s*key\s*:\s*([A-G](?:#|b)?m?)\b/i

export function keyFromChartText(text: string): MusicalKey | null {
  const match = text.match(KEY_LINE)
  if (!match) return null
  const raw = match[1]
  return (KEYS as readonly string[]).includes(raw) ? (raw as MusicalKey) : null
}

export function resolveSongKey(
  stored: string | undefined,
  sections: { lines?: { chords?: string }[] }[] | undefined,
  chartText?: string,
): MusicalKey {
  const trimmed = stored?.trim()
  const explicit = trimmed && (KEYS as readonly string[]).includes(trimmed) ? (trimmed as MusicalKey) : null
  const fromText = chartText ? keyFromChartText(chartText) : null
  const detected = detectKeyFromSections(sections)
  if (explicit && explicit !== 'C') return explicit
  return detected ?? fromText ?? explicit ?? 'C'
}
