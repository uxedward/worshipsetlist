import { PrismaClient } from '@prisma/client'
import { upsertWorshipSongs } from './upsertSongs.ts'

const prisma = new PrismaClient()

function nextSunday(): Date {
  const d = new Date()
  d.setHours(10, 0, 0, 0)
  const day = d.getDay()
  const add = day === 0 ? 0 : 7 - day
  d.setDate(d.getDate() + add)
  return d
}

async function main() {
  await prisma.preference.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      theme: 'dark',
      presentationFontSize: 'medium',
    },
    update: {},
  })

  const existing = await prisma.setlist.count()
  if (existing === 0) {
    await prisma.setlist.createMany({
      data: [
        {
          name: 'Sunday AM',
          serviceName: 'Morning Worship',
          date: nextSunday(),
          colorIndex: 0,
        },
        {
          name: 'Midweek',
          serviceName: 'Wednesday Night',
          colorIndex: 2,
        },
        {
          name: 'Easter',
          serviceName: 'Resurrection Sunday',
          colorIndex: 3,
        },
      ],
    })
  }

  const first = await prisma.setlist.findFirst({ orderBy: { createdAt: 'asc' } })
  if (first) {
    await prisma.preference.update({
      where: { id: 1 },
      data: { lastSetlistId: first.id },
    })
  }

  await upsertWorshipSongs(prisma)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
