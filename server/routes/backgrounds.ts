import { Router } from 'express'
import { prisma } from '../db.js'
import { deleteBackgroundMedia, readBackgroundRange } from '../backgroundMedia.js'
import {
  createSupabaseUpload,
  deleteLocalMedia,
  deleteSupabaseObject,
  findLocalMedia,
  presentVideoChunkBaseUrl,
  videoHostingStatus,
} from '../videoHosting.js'

export const backgroundsRouter = Router()

function toClient(row: {
  id: string
  label: string
  kind: string
  src: string
  poster: string | null
  sizeBytes?: number
  mimeType?: string | null
}) {
  const sizeBytes = row.sizeBytes && row.sizeBytes > 0 ? row.sizeBytes : undefined
  return {
    id: row.id,
    label: row.label,
    kind: 'video' as const,
    group: 'motion' as const,
    src: row.src,
    src4k: row.src,
    poster: row.poster ?? undefined,
    custom: true as const,
    sizeBytes,
    mimeType: row.mimeType || undefined,
    chunkBaseUrl: sizeBytes ? presentVideoChunkBaseUrl(row.id) ?? undefined : undefined,
  }
}

function isPlayable(row: { src: string; sizeBytes: number }) {
  return row.sizeBytes > 0 || /^https?:\/\//i.test(row.src)
}

function hostingPayload() {
  return videoHostingStatus()
}

backgroundsRouter.get('/', async (_req, res) => {
  const hosting = hostingPayload()
  try {
    const rows = await prisma.customBackground.findMany({ orderBy: { createdAt: 'asc' } })
    const ready = rows.filter(isPlayable)
    res.json({
      backgrounds: ready.map(toClient),
      storedCount: rows.length,
      readyCount: ready.length,
      pending: rows.filter((row) => !isPlayable(row)).map((row) => ({
        id: row.id,
        label: row.label,
        sizeBytes: row.sizeBytes,
        poster: row.poster ?? undefined,
      })),
      ...hosting,
    })
  } catch (err) {
    res.status(500).json({
      backgrounds: [],
      ...hosting,
      error: err instanceof Error ? err.message : 'Could not load uploaded videos.',
    })
  }
})

backgroundsRouter.post('/upload', async (req, res) => {
  const id = typeof req.body?.id === 'string' ? req.body.id.trim() : ''
  const filename = typeof req.body?.filename === 'string' ? req.body.filename.trim() : ''
  const chunkIndexRaw = req.body?.chunkIndex
  const chunkIndex =
    typeof chunkIndexRaw === 'number'
      ? chunkIndexRaw
      : typeof chunkIndexRaw === 'string' && chunkIndexRaw.trim()
        ? Number(chunkIndexRaw)
        : undefined
  if (!id) {
    res.status(400).json({ error: 'A video id is required.' })
    return
  }
  try {
    const session = await createSupabaseUpload(
      id,
      filename || 'video.mp4',
      process.env,
      Number.isFinite(chunkIndex) ? chunkIndex : undefined,
    )
    res.json(session)
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Could not start the video upload.',
    })
  }
})

backgroundsRouter.get('/media/:id', async (req, res) => {
  try {
    const media = await readBackgroundRange(req.params.id, req.headers.range)
    if (media) {
      res.status(media.partial ? 206 : 200)
      res.setHeader('Accept-Ranges', 'bytes')
      res.setHeader('Content-Type', media.mimeType)
      res.setHeader('Content-Length', String(media.body.length))
      if (media.partial) {
        res.setHeader('Content-Range', `bytes ${media.start}-${media.end}/${media.size}`)
      }
      res.setHeader('Cache-Control', 'private, no-store')
      res.setHeader('Vary', 'Range')
      res.end(media.body)
      return
    }
  } catch {
    /* fall through to local / remote URL */
  }

  const file = findLocalMedia(req.params.id)
  if (file) {
    res.sendFile(file, {
      maxAge: '365d',
      headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
    })
    return
  }

  try {
    const row = await prisma.customBackground.findUnique({ where: { id: req.params.id } })
    if (row?.src && /^https?:\/\//i.test(row.src)) {
      res.redirect(302, row.src)
      return
    }
  } catch {
    /* not found */
  }
  res.status(404).json({ error: 'Video not found.' })
})

backgroundsRouter.post('/', async (req, res) => {
  const label = typeof req.body?.label === 'string' ? req.body.label.trim() : ''
  const src = typeof req.body?.src === 'string' ? req.body.src.trim() : ''
  const poster = typeof req.body?.poster === 'string' ? req.body.poster : null
  const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType : undefined
  const sizeBytesRaw = req.body?.sizeBytes
  const sizeBytes =
    typeof sizeBytesRaw === 'number'
      ? sizeBytesRaw
      : typeof sizeBytesRaw === 'string' && sizeBytesRaw.trim()
        ? Number(sizeBytesRaw)
        : undefined
  const id =
    typeof req.body?.id === 'string' && req.body.id.trim()
      ? req.body.id.trim()
      : `custom-${crypto.randomUUID()}`
  if (!label || !src) {
    res.status(400).json({ error: 'A name and video URL are required.' })
    return
  }
  const extra: { mimeType?: string; sizeBytes?: number } = {}
  if (mimeType) extra.mimeType = mimeType
  if (typeof sizeBytes === 'number' && Number.isFinite(sizeBytes) && sizeBytes > 0) extra.sizeBytes = Math.floor(sizeBytes)
  try {
    const row = await prisma.customBackground.upsert({
      where: { id },
      create: { id, label, src, poster, kind: 'video', ...extra },
      update: { label, src, poster, ...extra },
    })
    res.status(201).json(toClient(row))
  } catch (err) {
    if (poster) {
      try {
        const row = await prisma.customBackground.upsert({
          where: { id },
          create: { id, label, src, poster: null, kind: 'video', ...extra },
          update: { label, src, ...extra },
        })
        res.status(201).json(toClient(row))
        return
      } catch {
        /* use original error */
      }
    }
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Could not save that background.',
    })
  }
})

backgroundsRouter.delete('/:id', async (req, res) => {
  const id = req.params.id
  try {
    const existing = await prisma.customBackground.findUnique({ where: { id } })
    await deleteBackgroundMedia(id)
    deleteLocalMedia(id)
    if (existing?.src) {
      if (existing.src.includes('vercel-storage.com') && hostingPayload().blobEnabled) {
        try {
          const { del } = await import('@vercel/blob')
          await del(existing.src)
        } catch {
          /* keep deleting the row even if blob cleanup fails */
        }
      } else {
        try {
          await deleteSupabaseObject(existing.src)
        } catch {
          /* keep deleting the row */
        }
      }
    }
    if (existing) await prisma.customBackground.delete({ where: { id } })
    res.json({ ok: true })
  } catch {
    res.json({ ok: true })
  }
})
