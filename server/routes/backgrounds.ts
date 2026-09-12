import { Router } from 'express'
import { prisma } from '../db.js'

export const backgroundsRouter = Router()

function blobEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

function toClient(row: { id: string; label: string; kind: string; src: string; poster: string | null }) {
  return {
    id: row.id,
    label: row.label,
    kind: row.kind === 'photo' ? 'photo' : 'video',
    group: row.kind === 'photo' ? 'still' : 'motion',
    src: row.src,
    poster: row.poster ?? undefined,
    custom: true,
  }
}

backgroundsRouter.get('/', async (_req, res) => {
  try {
    const rows = await prisma.customBackground.findMany({ orderBy: { createdAt: 'asc' } })
    res.json({ backgrounds: rows.map(toClient), blobEnabled: blobEnabled() })
  } catch {
    res.json({ backgrounds: [], blobEnabled: blobEnabled() })
  }
})

backgroundsRouter.post('/upload', async (req, res) => {
  if (!blobEnabled()) {
    res.status(501).json({ error: 'Video hosting is not configured on this server.' })
    return
  }
  try {
    const { handleUpload } = await import('@vercel/blob/client')
    const json = await handleUpload({
      body: req.body,
      request: req as never,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v'],
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
    if (existing?.src && blobEnabled()) {
      try {
        const { del } = await import('@vercel/blob')
        await del(existing.src)
      } catch {
        /* keep deleting the row even if blob cleanup fails */
      }
    }
    if (existing) await prisma.customBackground.delete({ where: { id } })
    res.json({ ok: true })
  } catch {
    res.json({ ok: true })
  }
})
