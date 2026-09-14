import { Router } from 'express'
import { prisma } from '../db.js'
import {
  createSupabaseUpload,
  deleteLocalMedia,
  deleteSupabaseObject,
  findLocalMedia,
  isBlobUploadBody,
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

function hostingPayload() {
  return videoHostingStatus()
}

backgroundsRouter.get('/', async (_req, res) => {
  const hosting = hostingPayload()
  try {
    const rows = await prisma.customBackground.findMany({ orderBy: { createdAt: 'asc' } })
    res.json({ backgrounds: rows.map(toClient), ...hosting })
  } catch {
    res.json({ backgrounds: [], ...hosting })
  }
})

backgroundsRouter.post('/upload', async (req, res) => {
  const hosting = hostingPayload()
  if (isBlobUploadBody(req.body) || hosting.provider === 'blob') {
    if (!hosting.blobEnabled) {
      res.status(501).json({ error: 'Video hosting is not configured on this server.' })
      return
    }
    try {
      const { handleUpload } = await import('@vercel/blob/client')
      const json = await handleUpload({
        body: req.body,
        request: req as never,
        onBeforeGenerateToken: async () => ({
          allowedContentTypes: [
            'video/mp4',
            'video/webm',
            'video/quicktime',
            'video/x-m4v',
            'video/mpeg',
            'application/octet-stream',
          ],
          addRandomSuffix: true,
          maximumSizeInBytes: 1024 * 1024 * 1024,
        }),
      })
      res.json(json)
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Could not start the video upload.',
      })
    }
    return
  }
  if (hosting.provider === 'supabase') {
    const id = typeof req.body?.id === 'string' ? req.body.id.trim() : ''
    const filename = typeof req.body?.filename === 'string' ? req.body.filename.trim() : ''
    if (!id || !filename) {
      res.status(400).json({ error: 'A video id and filename are required.' })
      return
    }
    try {
      const session = await createSupabaseUpload(id, filename)
      res.json(session)
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Could not start the video upload.',
      })
    }
    return
  }
  res.status(501).json({
    error: 'Video hosting is not configured, so uploads cannot appear in other browsers.',
  })
})

backgroundsRouter.get('/media/:id', (req, res) => {
  const file = findLocalMedia(req.params.id)
  if (!file) {
    res.status(404).json({ error: 'Video not found.' })
    return
  }
  res.sendFile(file, {
    maxAge: '365d',
    headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
  })
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
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Could not save that background.',
    })
  }
})

backgroundsRouter.delete('/:id', async (req, res) => {
  const id = req.params.id
  try {
    const existing = await prisma.customBackground.findUnique({ where: { id } })
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
      } else if (existing.src.startsWith('/api/backgrounds/media/')) {
        deleteLocalMedia(id)
      }
    } else {
      deleteLocalMedia(id)
    }
    if (existing) await prisma.customBackground.delete({ where: { id } })
    res.json({ ok: true })
  } catch {
    res.json({ ok: true })
  }
})
