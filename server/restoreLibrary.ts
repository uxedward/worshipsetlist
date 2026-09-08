import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { prisma } from './db.ts'
import { resolveSongKey } from '../shared/detectKey.ts'

type RestoreLine = { chords?: string; lyric?: string; order?: number }
type RestoreSection = { label: string; order: number; lines?: RestoreLine[] }
type RestoreSong = {
  id: string
  title: string
  artist: string
  album?: string | null
  key: string
  bpm: number
  timeSignature?: string
  tag: string
  durationSeconds?: number | null
  createdAt?: string
  sections?: RestoreSection[]
}

function restorePath() {
  const here = path.dirname(fileURLToPath(import.meta.url))
  return path.resolve(here, '../prisma/restoreLibrary.json')
}

export function loadRestoreSongs(): RestoreSong[] {
  const file = restorePath()
  if (!fs.existsSync(file)) return []
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as RestoreSong[]
  return Array.isArray(parsed) ? parsed : []
}

export async function restoreLibraryIfEmpty() {
  if ((await prisma.song.count()) > 0) return
  const songs = loadRestoreSongs()
  for (const song of songs) {
    await prisma.song.create({
      data: {
        id: song.id,
        title: song.title,
        artist: song.artist,
        album: song.album ?? null,
        key: resolveSongKey(song.key, song.sections),
        bpm: song.bpm,
        timeSignature: song.timeSignature || '4/4',
        tag: song.tag,
        durationSeconds: song.durationSeconds ?? null,
        createdAt: song.createdAt ? new Date(song.createdAt) : undefined,
        sections: {
          create: (song.sections ?? []).map((section) => ({
            label: section.label,
            order: section.order,
            lines: {
              create: (section.lines ?? []).map((line) => ({
                chords: line.chords ?? '',
                lyric: line.lyric ?? '',
                order: line.order ?? 0,
              })),
            },
          })),
        },
      },
    })
  }
}
