import { Router } from 'express'
import { prisma } from '../db.ts'
import { parseBulkImport, serializeExport } from '../../shared/bulkFormat.ts'
import type { SongInput } from '../../shared/types.ts'

export const songsRouter = Router()

const fullSong = {
  sections: {
    orderBy: { order: 'asc' as const },
    include: {
      lines: { orderBy: { order: 'asc' as const } },
    },
  },
}

songsRouter.get('/export', async (_req, res) => {
  const songs = await prisma.song.findMany({
    orderBy: [{ artist: 'asc' }, { title: 'asc' }],
    include: fullSong,
  })
  const body = serializeExport(
    songs.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
    })),
  )
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="setflow-songs.txt"')
  res.send(body)
})

songsRouter.post('/bulk-import', async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text : ''
  const blocks = parseBulkImport(text)
  let imported = 0
  let skipped = 0
  const reasons: string[] = []

  for (const block of blocks) {
    if (!block.input) {
      skipped++
      if (block.skipReason) reasons.push(block.skipReason)
      continue
    }
    await createSong(block.input)
    imported++
  }

  const reasonSummary = summarizeSkip(reasons)
  res.json({
    imported,
    skipped,
    message:
      skipped > 0
        ? `${imported} imported, ${skipped} skipped (${reasonSummary})`
        : `${imported} imported`,
  })
})

songsRouter.get('/', async (req, res) => {
  const artist = str(req.query.artist)
  const tag = str(req.query.tag)
  const search = str(req.query.search)
  const sort = str(req.query.sort) || 'artist'

  const songs = await prisma.song.findMany({
    where: {
      ...(artist ? { artist } : {}),
      ...(tag ? { tag } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { artist: { contains: search, mode: 'insensitive' } },
              { album: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy:
      sort === 'title'
        ? [{ title: 'asc' }, { artist: 'asc' }]
        : sort === 'bpm'
          ? [{ bpm: 'asc' }, { title: 'asc' }]
          : [{ artist: 'asc' }, { title: 'asc' }],
  })
  res.json(songs)
})

songsRouter.get('/:id', async (req, res) => {
  const song = await prisma.song.findUnique({
    where: { id: req.params.id },
    include: fullSong,
  })
  if (!song) {
    res.status(404).json({ error: 'Song not found' })
    return
  }
  res.json(song)
})

songsRouter.post('/', async (req, res) => {
  const input = req.body as SongInput
  const err = validateSong(input)
  if (err) {
    res.status(400).json({ error: err })
    return
  }
  const song = await createSong(input)
  res.status(201).json(song)
})

songsRouter.patch('/:id', async (req, res) => {
  const existing = await prisma.song.findUnique({ where: { id: req.params.id } })
  if (!existing) {
    res.status(404).json({ error: 'Song not found' })
    return
  }
  const input = req.body as SongInput
  const err = validateSong(input)
  if (err) {
    res.status(400).json({ error: err })
    return
  }

  const song = await prisma.$transaction(async (tx) => {
    await tx.line.deleteMany({ where: { section: { songId: req.params.id } } })
    await tx.section.deleteMany({ where: { songId: req.params.id } })
    return tx.song.update({
      where: { id: req.params.id },
      data: {
        title: input.title.trim(),
        artist: input.artist.trim(),
        album: input.album?.trim() || null,
        key: input.key,
        bpm: input.bpm,
        timeSignature: input.timeSignature || '4/4',
        tag: input.tag,
        durationSeconds: input.durationSeconds ?? null,
        sections: {
          create: input.sections.map((s) => ({
            label: s.label,
            order: s.order,
            lines: {
              create: s.lines.map((l) => ({
                chords: l.chords ?? '',
                lyric: l.lyric,
                order: l.order,
              })),
            },
          })),
        },
      },
      include: fullSong,
    })
  })
  res.json(song)
})

songsRouter.delete('/:id', async (req, res) => {
  const existing = await prisma.song.findUnique({ where: { id: req.params.id } })
  if (!existing) {
    res.status(404).json({ error: 'Song not found' })
    return
  }
  await prisma.setlistSong.deleteMany({ where: { songId: req.params.id } })
  await prisma.song.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
})

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

function validateSong(input: SongInput): string | null {
  if (!input?.title?.trim()) return 'Title is required'
  if (!input?.artist?.trim()) return 'Artist is required'
  if (!input?.key) return 'Key is required'
  if (typeof input.bpm !== 'number' || input.bpm < 40 || input.bpm > 200) {
    return 'BPM must be between 40 and 200'
  }
  if (!input.sections?.some((s) => s.lines?.some((l) => l.lyric?.trim()))) {
    return 'Chart must include at least one lyric line'
  }
  return null
}

async function createSong(input: SongInput) {
  return prisma.song.create({
    data: {
      title: input.title.trim(),
      artist: input.artist.trim(),
      album: input.album?.trim() || null,
      key: input.key,
      bpm: input.bpm,
      timeSignature: input.timeSignature || '4/4',
      tag: input.tag,
      durationSeconds: input.durationSeconds ?? null,
      sections: {
        create: (input.sections ?? []).map((s) => ({
          label: s.label,
          order: s.order,
          lines: {
            create: s.lines.map((l) => ({
              chords: l.chords ?? '',
              lyric: l.lyric,
              order: l.order,
            })),
          },
        })),
      },
    },
    include: fullSong,
  })
}

function summarizeSkip(reasons: string[]): string {
  if (reasons.length === 0) return 'invalid'
  const missingTitle = reasons.filter((r) => r.includes('title')).length
  const missingArtist = reasons.filter((r) => r.includes('artist') && !r.includes('title')).length
  const parts: string[] = []
  if (missingTitle) parts.push('missing title')
  if (missingArtist) parts.push('missing artist')
  return parts.join(', ') || reasons[0]
}
