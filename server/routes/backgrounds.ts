import { Router } from 'express'
import { prisma } from '../db.js'
import { deleteBackgroundMedia, readBackgroundRange } from '../backgroundMedia.js'
import {
  deleteLocalMedia,
  deleteSupabaseObject,
  findLocalMedia,
  videoHostingStatus,
} from '../videoHosting.js'

export const backgroundsRouter = Router()

function toClient(row: { id: string; label: string; kind: string; src: string; poster: string | null }) {
  return {
    id: row.id,
    label: row.label,
    kind: 'video' as const,
    group: 'motion' as const,
    src: row.src,
    src4k: row.src,
    poster: row.poster ?? undefined,
    custom: true as const,
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
    res.json({ backgrounds: rows.filter(isPlayable).map(toClient), ...hosting })
  } catch (err) {
    res.status(500).json({
      backgrounds: [],
      ...hosting,
      error: err instanceof Error ? err.message : 'Could not load uploaded videos.',
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
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
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
  const id =
    typeof req.body?.id === 'string' && req.body.id.trim()
      ? req.body.id.trim()
      : `custom-${crypto.randomUUID()}`
  if (!label || !src) {
    res.status(400).json({ error: 'A name and video URL are required.' })
    return
  }
  try {
    const row = await prisma.customBackground.upsert({
      where: { id },
      create: { id, label, src, poster, kind: 'video' },
      update: { label, src, poster },
    })
    res.status(201).json(toClient(row))
  } catch (err) {
    if (poster) {
      try {
        const row = await prisma.customBackground.upsert({
          where: { id },
          create: { id, label, src, poster: null, kind: 'video' },
          update: { label, src },
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
      } else if (existing.src.includes('/storage/v1/object/public/')) {
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
