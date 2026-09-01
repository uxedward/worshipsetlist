import { parseChart, chartToText } from './chartParser.js'
import { parseDuration, formatDuration } from './duration.js'
import type { Song, SongInput } from './types.js'

export interface BulkBlockMeta {
  title?: string
  artist?: string
  album?: string
  key?: string
  bpm?: number
  timeSignature?: string
  tag?: string
  durationSeconds?: number | null
}

export interface BulkSongPreview {
  meta: BulkBlockMeta
  chartText: string
  input: SongInput | null
  skipReason?: string
}

const META_KEYS: Record<string, string> = {
  title: 'title',
  artist: 'artist',
  album: 'album',
  key: 'key',
  bpm: 'bpm',
  tag: 'tag',
  duration: 'duration',
  'time signature': 'timeSignature',
  timesignature: 'timeSignature',
}

function parseMetaLine(line: string): [string, string] | null {
  const idx = line.indexOf(':')
  if (idx <= 0) return null
  const key = line.slice(0, idx).trim().toLowerCase()
  const mapped = META_KEYS[key]
  if (!mapped) return null
  return [mapped, line.slice(idx + 1).trim()]
}

export function parseBulkBlock(block: string): BulkSongPreview {
  const lines = block.replace(/\r\n/g, '\n').split('\n')
  const meta: BulkBlockMeta = {}
  let chartStart = 0
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!trimmed) {
      if (Object.keys(meta).length > 0) {
        chartStart = i + 1
        break
      }
      continue
    }
    const parsed = parseMetaLine(trimmed)
    if (parsed) {
      const [k, v] = parsed
      if (k === 'bpm') meta.bpm = Number(v) || undefined
      else if (k === 'duration') meta.durationSeconds = parseDuration(v)
      else if (k === 'title') meta.title = v
      else if (k === 'artist') meta.artist = v
      else if (k === 'album') meta.album = v
      else if (k === 'key') meta.key = v
      else if (k === 'tag') meta.tag = v
      else if (k === 'timeSignature') meta.timeSignature = v
      chartStart = i + 1
    } else {
      chartStart = i
      break
    }
  }

  const chartText = lines.slice(chartStart).join('\n').replace(/^\n+/, '').replace(/\n+$/, '')
  const { sections } = parseChart(chartText)

  if (!meta.title || !meta.artist) {
    return {
      meta,
      chartText,
      input: null,
      skipReason: !meta.title && !meta.artist ? 'missing title and artist' : !meta.title ? 'missing title' : 'missing artist',
    }
  }

  const input: SongInput = {
    title: meta.title,
    artist: meta.artist,
    album: meta.album ?? null,
    key: meta.key || 'C',
    bpm: meta.bpm && meta.bpm >= 40 && meta.bpm <= 200 ? meta.bpm : 80,
    timeSignature: meta.timeSignature || '4/4',
    tag: meta.tag || 'Worship',
    durationSeconds: meta.durationSeconds ?? null,
    sections: sections.map((s) => ({
      label: s.label,
      order: s.order,
      lines: s.lines.map((l) => ({
        chords: l.chords,
        lyric: l.lyric,
        order: l.order,
      })),
    })),
  }

  return { meta, chartText, input }
}

export function parseBulkImport(text: string): BulkSongPreview[] {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []
  const parts = normalized.split(/^\s*===\s*$/m).map((p) => p.trim()).filter(Boolean)
  return parts.map(parseBulkBlock)
}

export function serializeSong(song: Song): string {
  const lines: string[] = [
    `Title: ${song.title}`,
    `Artist: ${song.artist}`,
  ]
  if (song.album) lines.push(`Album: ${song.album}`)
  lines.push(`Key: ${song.key}`)
  lines.push(`BPM: ${song.bpm}`)
  if (song.timeSignature && song.timeSignature !== '4/4') {
    lines.push(`Time Signature: ${song.timeSignature}`)
  }
  lines.push(`Tag: ${song.tag}`)
  if (song.durationSeconds != null) {
    lines.push(`Duration: ${formatDuration(song.durationSeconds)}`)
  }
  lines.push('')
  if (song.sections && song.sections.length > 0) {
    const sorted = [...song.sections].sort((a, b) => a.order - b.order)
    lines.push(
      chartToText(
        sorted.map((s) => ({
          label: s.label,
          lines: [...s.lines]
            .sort((a, b) => a.order - b.order)
            .map((l) => ({ chords: l.chords, lyric: l.lyric })),
        })),
      ),
    )
  }
  return lines.join('\n')
}

export function serializeExport(songs: Song[]): string {
  if (songs.length === 0) return '===\n'
  return songs.map((s) => `===\n${serializeSong(s)}\n===`).join('\n') + '\n'
}

export function formatSetlistPlain(songs: { title: string; key: string; bpm: number }[]): string {
  return songs
    .map((s, i) => `${i + 1}. ${s.title} — ${s.key} — ${s.bpm} BPM`)
    .join('\n')
}
