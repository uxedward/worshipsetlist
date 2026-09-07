import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { remoteSqliteFromEnv } from '../shared/remoteDb.ts'

const here = path.dirname(fileURLToPath(import.meta.url))

function existingFile(candidates: string[]) {
  return candidates.find((file) => {
    try {
      return fs.statSync(file).isFile()
    } catch {
      return false
    }
  })
}

export function findBundledDb() {
  return existingFile([
    path.join(here, '../prisma/setflow.db'),
    path.join(process.cwd(), 'prisma/setflow.db'),
    path.join(process.cwd(), 'setflow.db'),
    '/var/task/prisma/setflow.db',
    '/var/task/setflow.db',
  ])
}

function fileDatabaseUrl() {
  const bundled = findBundledDb()
  if (process.env.VERCEL) {
    const dest = '/tmp/setflow.db'
    if (bundled) {
      fs.copyFileSync(bundled, dest)
      return `file:${dest}`
    }
    if (fs.existsSync(dest)) return `file:${dest}`
    console.error('SQLite file missing. cwd=', process.cwd(), 'here=', here)
  }
  if (bundled) return `file:${bundled}`
  return process.env.DATABASE_URL || 'file:./setflow.db'
}

const remote = remoteSqliteFromEnv()
export const durableDatabase = Boolean(remote)

function createPrisma(): PrismaClient {
  if (remote) {
    const adapter = new PrismaLibSQL({
      url: remote.url,
      authToken: remote.authToken,
    })
    return new PrismaClient({ adapter })
  }
  const url = fileDatabaseUrl()
  process.env.DATABASE_URL = url
  if (process.env.VERCEL) {
    console.warn(
      'Setflow is using an ephemeral /tmp SQLite file. Add TURSO_DATABASE_URL and TURSO_AUTH_TOKEN so songs stay saved.',
    )
  }
  return new PrismaClient({
    datasources: { db: { url } },
  })
}

export const prisma = createPrisma()
