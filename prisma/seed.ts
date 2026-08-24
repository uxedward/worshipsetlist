import { PrismaClient } from '@prisma/client'
import { ensureDemoData } from './upsertSongs.ts'

const prisma = new PrismaClient()

async function main() {
  await ensureDemoData(prisma)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
