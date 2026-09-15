import express from 'express'
import cors from 'cors'
import type { IncomingMessage } from 'node:http'
import { songsRouter } from './routes/songs.js'
import { setlistsRouter } from './routes/setlists.js'
import { preferencesRouter } from './routes/preferences.js'
import { backgroundsRouter } from './routes/backgrounds.js'
import { databaseBackend, durableDatabase, isPoolTimeout, prisma, releasePrisma } from './db.js'
import { databaseVendor } from './hostedDatabase.js'
import { loadBootstrap } from './bootstrap.js'
import { readRequestBuffer, saveBackgroundChunk } from './backgroundMedia.js'
import { needsDatabasePrepare, skipDatabasePrepare } from './skipPrepare.js'
import { videoHostingStatus } from './videoHosting.js'

export const app = express()

let prepared = false
let preparing: Promise<void> | null = null

async function prepareDatabase() {
  if (prepared) return
  if (!preparing) {
    preparing = import('./cloneLibrary.js')
      .then(({ ensurePersistentDatabase }) => ensurePersistentDatabase())
      .then(() => {
        prepared = true
      })
      .catch((err) => {
        preparing = null
        console.error('Could not prepare the song database', err)
      })
  }
  await preparing
}

app.use((req, _res, next) => {
  const original = vercelOriginalUrl(req)
  if (original && original !== req.url) req.url = original
  next()
})

app.use(cors())

app.put('/api/backgrounds/media/:id', async (req, res) => {
  const filename = typeof req.query.name === 'string' ? req.query.name : `${req.params.id}.mp4`
  const mimeType = typeof req.query.type === 'string' ? req.query.type : undefined
  const chunk = Number(typeof req.query.chunk === 'string' ? req.query.chunk : 0)
  const chunks = Number(typeof req.query.chunks === 'string' ? req.query.chunks : 1)
  try {
    const data = await readRequestBuffer(req)
    const write = () =>
      saveBackgroundChunk({
        id: req.params.id,
        filename,
        mimeType,
        chunkIndex: Number.isFinite(chunk) ? chunk : 0,
        chunkCount: Number.isFinite(chunks) && chunks > 0 ? chunks : 1,
        data,
      })
    let saved
    try {
      saved = await write()
    } catch (err) {
      if (!needsDatabasePrepare(err)) throw err
      await prepareDatabase()
      saved = await write()
    }
    res.json(saved)
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Could not save that video.',
    })
  }
})

app.use(express.json({ limit: '10mb' }))

function requestPath(req: { url?: string }) {
  return (req.url || '').split('?')[0]
}

app.use(async (req, _res, next) => {
  if (skipDatabasePrepare(req.method, requestPath(req))) return next()
  await prepareDatabase()
  next()
})

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    let customBackgrounds = 0
    let customBackgroundReady = 0
    try {
      customBackgrounds = await prisma.customBackground.count()
      customBackgroundReady = await prisma.customBackground.count({
        where: { OR: [{ sizeBytes: { gt: 0 } }, { src: { startsWith: 'http' } }] },
      })
    } catch {
      /* schema may still be creating */
    }
    res.json({
      ok: true,
      durable: durableDatabase,
      backend: databaseBackend,
      vendor: databaseVendor(process.env.DATABASE_URL || ''),
      customBackgrounds,
      customBackgroundReady,
      ...videoHostingStatus(),
    })
  } catch (err) {
    if (isPoolTimeout(err)) await releasePrisma()
    res.status(503).json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
})

app.get('/api/bootstrap', async (_req, res) => {
  try {
    try {
      res.json(await loadBootstrap())
      return
    } catch (err) {
      if (!needsDatabasePrepare(err)) throw err
      await prepareDatabase()
      res.json(await loadBootstrap())
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (isPoolTimeout(err)) await releasePrisma()
    const busy = /too many connections|timed out fetching a new connection/i.test(message)
    res.status(busy ? 503 : 500).json({
      error: busy ? 'The database is busy. Retry in a moment.' : message,
    })
  }
})

app.use('/api/songs', songsRouter)
app.use('/api/setlists', setlistsRouter)
app.use('/api/preferences', preferencesRouter)
app.use('/api/backgrounds', backgroundsRouter)

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : String(err)
  if (isPoolTimeout(err)) void releasePrisma()
  const busy = /too many connections|timed out fetching a new connection/i.test(message)
  if (!res.headersSent) {
    res.status(busy ? 503 : 500).json({
      error: busy ? 'The database is busy. Retry in a moment.' : message,
    })
  }
})

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
