import { app } from './index.js'
import { prisma } from './db.js'
import { ensureDemoData } from '../prisma/upsertSongs.js'

const PORT = Number(process.env.PORT) || 3001

app.listen(PORT, () => {
  console.log(`Setflow API on http://localhost:${PORT}`)
})

void ensureDemoData(prisma).catch((err) => {
  console.error('Could not prepare the song database', err)
})
