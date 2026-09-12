import { prisma } from './db.ts'
import { SCHEMA_STATEMENTS } from './schemaSql.ts'
import { restoreLibraryIfEmpty } from './restoreLibrary.ts'

let ready: Promise<void> | null = null

export async function ensurePersistentDatabase() {
  if (!ready) {
    ready = prepare().catch((err) => {
      ready = null
      throw err
    })
  }
  await ready
}

export async function persistGithubWrites() {
  // Production uses hosted Postgres; GitHub sqlite sync is unused.
}

async function prepare() {
  await ensureSchema()
  await ensureWorkspace()
  await restoreLibraryIfEmpty()
}

export async function songTableExists() {
  const rows = await prisma.$queryRaw<Array<{ present: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'Song'
    ) AS present
  `
  return Boolean(rows[0]?.present)
}

async function ensureSchema() {
  for (const statement of SCHEMA_STATEMENTS) {
    try {
      await prisma.$executeRawUnsafe(statement)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (/already exists|duplicate/i.test(message)) continue
      throw err
    }
  }
}

function nextSunday(): Date {
  const d = new Date()
  d.setHours(10, 0, 0, 0)
  const day = d.getDay()
  const add = day === 0 ? 0 : 7 - day
  d.setDate(d.getDate() + add)
  return d
}

async function ensureWorkspace() {
  await prisma.preference.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      theme: 'dark',
      presentationFontSize: 'medium',
    },
    update: {},
  })

  if ((await prisma.setlist.count()) === 0) {
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
      ],
    })
  }

  const first = await prisma.setlist.findFirst({ orderBy: { createdAt: 'asc' } })
  if (first) {
    const prefs = await prisma.preference.findUnique({ where: { id: 1 } })
    if (!prefs?.lastSetlistId) {
      await prisma.preference.update({
        where: { id: 1 },
        data: { lastSetlistId: first.id },
      })
    }
  }
}
