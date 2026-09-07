import { PrismaClient } from '@prisma/client'
import fs from 'node:fs'
import {
  databaseBackend,
  durableDatabase,
  findBundledDb,
  prisma,
  recreateFilePrisma,
  githubRuntimePath,
  sqliteFilePath,
} from './db.ts'
import { pullGithubDatabase, pushGithubDatabase } from './githubStore.ts'

let ready: Promise<void> | null = null

export async function ensurePersistentDatabase() {
  if (!ready) ready = prepare().catch((err) => {
    ready = null
    throw err
  })
  await ready
}

export async function persistGithubWrites() {
  const { prisma: db, sqliteFilePath: filePath, databaseBackend: backend } = await import('./db.ts')
  if (backend !== 'github' || !filePath) return
  await db.$queryRaw`PRAGMA wal_checkpoint(TRUNCATE)`
  await pushGithubDatabase(filePath)
}

async function prepare() {
  if (databaseBackend === 'github') {
    await restoreGithubDatabase()
    return
  }
  if (!durableDatabase) return
  const songs = await prisma.song.count()
  if (songs > 0) return
  const bundled = findBundledDb()
  if (!bundled) return

  const local = new PrismaClient({
    datasources: { db: { url: `file:${bundled}` } },
  })
  try {
    await cloneLibrary(local, prisma)
  } finally {
    await local.$disconnect()
  }
}

async function restoreGithubDatabase() {
  const bundled = findBundledDb()
  const dest = sqliteFilePath || githubRuntimePath()
  if (!dest) throw new Error('No SQLite file path available for the GitHub database')
  await prisma.$disconnect()
  for (const extra of [`${dest}-wal`, `${dest}-shm`]) {
    try {
      fs.unlinkSync(extra)
    } catch {
      // no WAL sidecar
    }
  }
  const pulled = await pullGithubDatabase(dest)
  if (!pulled && bundled && bundled !== dest) fs.copyFileSync(bundled, dest)
  recreateFilePrisma()
  if (!pulled) await pushGithubDatabase(dest)
}

async function cloneLibrary(from: PrismaClient, to: PrismaClient) {
  const prefs = await from.preference.findMany()
  for (const row of prefs) {
    await to.preference.upsert({
      where: { id: row.id },
      create: row,
      update: {},
    })
  }

  const songs = await from.song.findMany({
    include: {
      sections: { include: { lines: true }, orderBy: { order: 'asc' } },
    },
    orderBy: { createdAt: 'asc' },
  })
  for (const song of songs) {
    await to.song.create({
      data: {
        id: song.id,
        title: song.title,
        artist: song.artist,
        album: song.album,
        key: song.key,
        bpm: song.bpm,
        timeSignature: song.timeSignature,
        tag: song.tag,
        durationSeconds: song.durationSeconds,
        createdAt: song.createdAt,
        sections: {
          create: song.sections.map((section) => ({
            id: section.id,
            label: section.label,
            order: section.order,
            lines: {
              create: section.lines.map((line) => ({
                id: line.id,
                chords: line.chords,
                lyric: line.lyric,
                order: line.order,
              })),
            },
          })),
        },
      },
    })
  }

  const setlists = await from.setlist.findMany({
    include: { songs: { orderBy: { order: 'asc' } } },
    orderBy: { createdAt: 'asc' },
  })
  for (const setlist of setlists) {
    await to.setlist.create({
      data: {
        id: setlist.id,
        name: setlist.name,
        description: setlist.description,
        serviceName: setlist.serviceName,
        date: setlist.date,
        colorIndex: setlist.colorIndex,
        createdAt: setlist.createdAt,
        updatedAt: setlist.updatedAt,
        songs: {
          create: setlist.songs.map((row) => ({
            id: row.id,
            songId: row.songId,
            order: row.order,
            transposedKey: row.transposedKey,
            notes: row.notes,
          })),
        },
      },
    })
  }
}
