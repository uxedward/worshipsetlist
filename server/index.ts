import express from 'express'
import cors from 'cors'
import type { IncomingMessage } from 'node:http'
import { songsRouter } from './routes/songs.js'
import { setlistsRouter } from './routes/setlists.js'
import { preferencesRouter } from './routes/preferences.js'
import { prisma } from './db.js'

export const app = express()

app.use((req, _res, next) => {
  const original = vercelOriginalUrl(req)
  if (original && original !== req.url) req.url = original
  next()
})

app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    const songs = await prisma.song.count()
    res.json({ ok: true, songs })
  } catch (err) {
    res.status(503).json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
})

app.use('/api/songs', songsRouter)
app.use('/api/setlists', setlistsRouter)
app.use('/api/preferences', preferencesRouter)

function vercelOriginalUrl(req: IncomingMessage) {
  const header =
    firstHeader(req.headers['x-invoke-path']) ||
    firstHeader(req.headers['x-forwarded-uri']) ||
    firstHeader(req.headers['x-vercel-original-path'])
  if (!header) return null
  const queryIndex = req.url?.indexOf('?') ?? -1
  const query = queryIndex >= 0 ? req.url!.slice(queryIndex) : ''
  if (header.includes('?')) return header
  return header + query
}

function firstHeader(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]
  return value
}
