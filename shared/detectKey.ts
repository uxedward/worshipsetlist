import { KEYS, MINOR_KEYS, type MusicalKey } from './types.ts'
import { parseChord, noteIndex } from './transpose.ts'

/** Expected chord quality by scale degree (1 = major, -1 = minor). */
const MAJOR_QUALITY: Record<number, 1 | -1> = {
  0: 1,
  2: -1,
  4: -1,
  5: 1,
  7: 1,
  9: -1,
}
const MINOR_QUALITY: Record<number, 1 | -1> = {
  0: -1,
  3: 1,
  5: -1,
  7: -1,
  8: 1,
  10: 1,
}

type ChordHit = { pc: number; minor: boolean; weight: number; hookStart: boolean }

function isMinorQuality(quality: string): boolean {
  const q = quality.toLowerCase()
  if (!q || q.startsWith('maj') || q.startsWith('sus') || q.startsWith('dim') || q.startsWith('aug')) return false
  if (q.startsWith('min') || q.startsWith('mi')) return true
  return q.startsWith('m')
}

function parseHit(token: string, weight = 1, hookStart = false): ChordHit | null {
  const parsed = parseChord(token)
  if (!parsed) return null
  return {
    pc: noteIndex(parsed.root + parsed.accidental),
    minor: isMinorQuality(parsed.quality),
    weight,
    hookStart,
  }
}

function sectionWeight(label: string | undefined): { weight: number; hook: boolean } {
  const l = (label ?? '').toLowerCase()
  if (/(intro)/.test(l)) return { weight: 0.35, hook: false }
  if (/(outro|ending|interlude|instrumental|\bmusic\b)/.test(l)) return { weight: 0.45, hook: false }
  if (/(chorus|reff|refrein|hook|bridge|verse|bait)/.test(l)) return { weight: 2, hook: true }
  return { weight: 1, hook: false }
}

export function chordsFromSections(sections: { label?: string; lines?: { chords?: string }[] }[] | undefined): string[] {
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

function hitsFromSections(sections: { label?: string; lines?: { chords?: string }[] }[] | undefined): ChordHit[] {
  if (!sections?.length) return []
  const hits: ChordHit[] = []
  for (const section of sections) {
    const { weight, hook } = sectionWeight(section.label)
    let firstInSection = true
    for (const line of section.lines ?? []) {
      for (const token of (line.chords ?? '').trim().split(/\s+/)) {
        const hit = parseHit(token, weight, hook && firstInSection)
        if (!hit) continue
        hits.push(hit)
        firstInSection = false
      }
    }
  }
  return hits
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
  const expected = minor ? MINOR_QUALITY : MAJOR_QUALITY
  let score = 0
  hits.forEach((hit, i) => {
    const w = hit.weight
    const deg = relative(hit.pc, tonic)
    const quality = expected[deg]
    const hitSign = hit.minor ? -1 : 1
    if (quality == null) {
      score -= 4 * w
      return
    }
    if (quality === hitSign) score += 2 * w
    else score -= 1.5 * w

    if (deg === 0) {
      const tonicQuality = hit.minor === minor
      score += (tonicQuality ? 5 : 1) * w
      if (tonicQuality && hit.hookStart) score += 8
      if (tonicQuality && i === 0 && hit.weight >= 1) score += 4
      if (tonicQuality && i === hits.length - 1) score += 4 * w
    } else if (deg === 7 && !hit.minor) {
      score += 3 * w
    } else if (deg === 5) {
      score += 2 * w
    } else if (!minor && deg === 9 && hit.minor) {
      score += 1 * w
    } else if (minor && deg === 3 && !hit.minor) {
      score += 1 * w
    } else if (minor && deg === 7 && !hit.minor) {
      // Harmonic minor V
      score += 3 * w
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

function pickKey(hits: ChordHit[], tokens: string[]): MusicalKey | null {
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

  const hook = hits.find((hit) => hit.hookStart)
  if (hook) {
    const hookKey = ranked.find((row) => {
      const tonic = tonicOf(row.key)
      return tonic.pc === hook.pc && tonic.minor === hook.minor
    })
    if (hookKey && hookKey.score >= best.score * 0.82) return hookKey.key
  }

  return best.key
}

export function detectKeyFromChords(tokens: string[]): MusicalKey | null {
  const hits = tokens.map((token) => parseHit(token)).filter((hit): hit is ChordHit => Boolean(hit))
  return pickKey(hits, tokens)
}

export function detectKeyFromSections(
  sections: { label?: string; lines?: { chords?: string }[] }[] | undefined,
): MusicalKey | null {
  const hits = hitsFromSections(sections)
  return pickKey(hits, chordsFromSections(sections))
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
