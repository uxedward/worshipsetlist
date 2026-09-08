import express from 'express'
import cors from 'cors'
import type { IncomingMessage } from 'node:http'
import { songsRouter } from './routes/songs.js'
import { setlistsRouter } from './routes/setlists.js'
import { preferencesRouter } from './routes/preferences.js'
import { databaseBackend, durableDatabase, isPoolTimeout, prisma, releasePrisma } from './db.js'
import { databaseVendor } from './hostedDatabase.js'
import { loadBootstrap } from './bootstrap.js'

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
app.use(express.json({ limit: '10mb' }))

function requestPath(req: { url?: string }) {
  return (req.url || '').split('?')[0]
}

app.use(async (req, _res, next) => {
  // Health must not wait on schema/restore — that blocked the app from loading.
  if (requestPath(req) === '/api/health') return next()
  await prepareDatabase()
  next()
})

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({
      ok: true,
      durable: durableDatabase,
      backend: databaseBackend,
      vendor: databaseVendor(process.env.DATABASE_URL || ''),
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
    res.json(await loadBootstrap())
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
