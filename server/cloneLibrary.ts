import { durableDatabase, prisma } from './db.ts'

let ready: Promise<void> | null = null

export async function ensurePersistentDatabase() {
  if (!ready) ready = prepare().catch((err) => {
    ready = null
    throw err
  })
  await ready
}

export async function persistGithubWrites() {
  // Production uses hosted Postgres; GitHub sqlite sync is unused.
}

async function prepare() {
  if (!durableDatabase) return
  await prisma.$queryRaw`SELECT 1`
}
