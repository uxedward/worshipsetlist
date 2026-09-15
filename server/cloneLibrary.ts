import { prisma } from './db.ts'
import { REVOKE_PUBLIC_ACCESS_STATEMENTS, RLS_STATEMENTS, SCHEMA_STATEMENTS } from './schemaSql.ts'
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
  await ensureRowLevelSecurity()
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
  if (await songTableExists()) return
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

const SAFE_TABLE = /^[A-Za-z_][A-Za-z0-9_]*$/
let rowLevelSecurityReady = false

function quotedTable(name: string) {
  if (!SAFE_TABLE.test(name)) throw new Error('Unexpected table name')
  return `"${name}"`
}

/** Close the public Data API. Prisma still connects as the database owner, which bypasses RLS. */
export async function ensureRowLevelSecurity() {
  if (rowLevelSecurityReady) return
  try {
    await prisma.$executeRawUnsafe(`SET statement_timeout = '2500'`)
    await prisma.$executeRawUnsafe(`SET lock_timeout = '1000'`)
    const open = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND NOT rowsecurity
        AND tablename !~ '^pg_'
    `
    for (const row of open) {
      if (!SAFE_TABLE.test(row.tablename)) continue
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE ${quotedTable(row.tablename)} ENABLE ROW LEVEL SECURITY`)
      } catch {
        /* lock timeout / pooler — retry on the next write */
      }
    }
    for (const statement of [...RLS_STATEMENTS, ...REVOKE_PUBLIC_ACCESS_STATEMENTS]) {
      try {
        await prisma.$executeRawUnsafe(statement)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        if (/does not exist|undefined_object|42704|timeout|lock/i.test(message)) continue
        throw err
      }
    }
    const stillOpen = await prisma.$queryRaw<Array<{ n: bigint | number }>>`
      SELECT COUNT(*)::int AS n
      FROM pg_tables
      WHERE schemaname = 'public'
        AND NOT rowsecurity
        AND tablename !~ '^pg_'
    `
    if (Number(stillOpen[0]?.n ?? 1) === 0) rowLevelSecurityReady = true
  } catch (err) {
    console.error('Could not enable row level security', err)
  } finally {
    try {
      await prisma.$executeRawUnsafe(`SET statement_timeout = '0'`)
      await prisma.$executeRawUnsafe(`SET lock_timeout = '0'`)
    } catch {
      /* keep serving even if timeouts cannot be reset */
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
