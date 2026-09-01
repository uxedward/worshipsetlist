import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { songsRouter } from './routes/songs.ts'
import { setlistsRouter } from './routes/setlists.ts'
import { preferencesRouter } from './routes/preferences.ts'
import { prisma } from './db.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const app = express()
const PORT = Number(process.env.PORT) || 3001

app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ ok: true })
  } catch {
    res.status(503).json({ ok: false })
  }
})

app.use('/api/songs', songsRouter)
app.use('/api/setlists', setlistsRouter)
app.use('/api/preferences', preferencesRouter)

if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
  const dist = path.resolve(__dirname, '../client/dist')
  app.use(express.static(dist))
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(path.join(dist, 'index.html'))
  })
}

async function boot() {
  if (!process.env.VERCEL) {
    try {
      const { ensureDemoData } = await import('../prisma/upsertSongs.ts')
      await ensureDemoData(prisma)
    } catch (err) {
      console.error('Could not load the song library on startup', err)
    }
  }
  app.listen(PORT, () => {
    console.log(`Setflow API on http://localhost:${PORT}`)
  })
}

if (!process.env.VERCEL) {
  void boot()
}
