import { app } from './index'
import { prisma } from './db'
import { ensureDemoData } from '../prisma/upsertSongs'

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
