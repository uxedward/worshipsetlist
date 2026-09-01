import { app } from './index.js'
import { prisma } from './db.js'
import { ensureDemoData } from '../prisma/upsertSongs.js'

const PORT = Number(process.env.PORT) || 3001

async function boot() {
  try {
    await ensureDemoData(prisma)
  } catch (err) {
    console.error('Could not load the song library on startup', err)
  }
  app.listen(PORT, () => {
    console.log(`Setflow API on http://localhost:${PORT}`)
  })
}

void boot()
