import { PrismaClient } from '@prisma/client'
import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import { durableDatabase, findBundledDb, prisma } from './db.ts'

let ready: Promise<void> | null = null

export async function ensurePersistentDatabase() {
  if (!ready) ready = prepare().catch((err) => {
    ready = null
    throw err
  })
  await ready
}

export async function persistGithubWrites() {
  // Production uses hosted Postgres; GitHub sqlite sync is unused.
}

async function prepare() {
  if (!durableDatabase) return
  const songs = await prisma.song.count()
  if (songs > 0) return
  const bundled = findBundledDb()
  if (!bundled) return
  await cloneFromSqliteFile(bundled, prisma)
}

function msToDate(value: unknown) {
  if (value == null) return null
  if (typeof value === 'number') return new Date(value)
  if (typeof value === 'bigint') return new Date(Number(value))
  if (typeof value === 'string' && /^\d+$/.test(value)) return new Date(Number(value))
  return new Date(String(value))
}

async function cloneFromSqliteFile(file: string, to: PrismaClient) {
  if (!fs.existsSync(file)) return
  const from = new DatabaseSync(file)
  try {
    const prefs = from.prepare('SELECT * FROM Preference').all()
    for (const row of prefs) {
      await to.preference.upsert({
        where: { id: Number(row.id) },
        create: {
          id: Number(row.id),
          theme: String(row.theme),
          presentationFontSize: String(row.presentationFontSize),
          lastSetlistId: row.lastSetlistId ? String(row.lastSetlistId) : null,
        },
        update: {},
      })
    }

    const songs = from.prepare('SELECT * FROM Song ORDER BY createdAt ASC').all()
    const sections = from.prepare('SELECT * FROM Section ORDER BY "order" ASC').all()
    const lines = from.prepare('SELECT * FROM Line ORDER BY "order" ASC').all()
    const sectionsBySong = new Map<string, typeof sections>()
    for (const section of sections) {
      const songId = String(section.songId)
      const list = sectionsBySong.get(songId) || []
      list.push(section)
      sectionsBySong.set(songId, list)
    }
    const linesBySection = new Map<string, typeof lines>()
    for (const line of lines) {
      const sectionId = String(line.sectionId)
      const list = linesBySection.get(sectionId) || []
      list.push(line)
      linesBySection.set(sectionId, list)
    }

    for (const song of songs) {
      const songId = String(song.id)
      await to.song.create({
        data: {
          id: songId,
          title: String(song.title),
          artist: String(song.artist),
          album: song.album ? String(song.album) : null,
          key: String(song.key),
          bpm: Number(song.bpm),
          timeSignature: String(song.timeSignature || '4/4'),
          tag: String(song.tag),
          durationSeconds: song.durationSeconds == null ? null : Number(song.durationSeconds),
          createdAt: msToDate(song.createdAt) || new Date(),
          sections: {
            create: (sectionsBySong.get(songId) || []).map((section) => ({
              id: String(section.id),
              label: String(section.label),
              order: Number(section.order),
              lines: {
                create: (linesBySection.get(String(section.id)) || []).map((line) => ({
                  id: String(line.id),
                  chords: String(line.chords ?? ''),
                  lyric: String(line.lyric),
                  order: Number(line.order),
                })),
              },
            })),
          },
        },
      })
    }

    const setlists = from.prepare('SELECT * FROM Setlist ORDER BY createdAt ASC').all()
    const setlistSongs = from.prepare('SELECT * FROM SetlistSong ORDER BY "order" ASC').all()
    const songsBySetlist = new Map<string, typeof setlistSongs>()
    for (const row of setlistSongs) {
      const setlistId = String(row.setlistId)
      const list = songsBySetlist.get(setlistId) || []
      list.push(row)
      songsBySetlist.set(setlistId, list)
    }
    for (const setlist of setlists) {
      const setlistId = String(setlist.id)
      await to.setlist.create({
        data: {
          id: setlistId,
          name: String(setlist.name),
          description: setlist.description ? String(setlist.description) : null,
          serviceName: setlist.serviceName ? String(setlist.serviceName) : null,
          date: msToDate(setlist.date),
          colorIndex: Number(setlist.colorIndex),
          createdAt: msToDate(setlist.createdAt) || new Date(),
          updatedAt: msToDate(setlist.updatedAt) || new Date(),
          songs: {
            create: (songsBySetlist.get(setlistId) || []).map((row) => ({
              id: String(row.id),
              songId: String(row.songId),
              order: Number(row.order),
              transposedKey: row.transposedKey ? String(row.transposedKey) : null,
              notes: row.notes ? String(row.notes) : null,
            })),
          },
        },
      })
    }
  } finally {
    from.close()
  }
}
