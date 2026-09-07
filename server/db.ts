import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { githubSqliteFromEnv } from '../shared/githubDb.ts'
import { remoteSqliteFromEnv } from '../shared/remoteDb.ts'

const here = path.dirname(fileURLToPath(import.meta.url))

export type DatabaseBackend = 'turso' | 'github' | 'file'

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

export const vercelSqlitePath = '/tmp/setflow.db'

export function githubRuntimePath() {
  return process.env.VERCEL ? vercelSqlitePath : '/tmp/setflow-github.db'
}

function fileDatabaseUrl() {
  const bundled = findBundledDb()
  if (githubSqliteFromEnv() && !remoteSqliteFromEnv()) {
    const dest = githubRuntimePath()
    if (bundled && !fs.existsSync(dest)) fs.copyFileSync(bundled, dest)
    return `file:${dest}`
  }
  if (process.env.VERCEL) {
    const dest = vercelSqlitePath
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
const github = githubSqliteFromEnv()
export const databaseBackend: DatabaseBackend = remote ? 'turso' : github ? 'github' : 'file'
export const durableDatabase = databaseBackend !== 'file'

function sqlitePathFromUrl(url: string) {
  return url.startsWith('file:') ? url.slice('file:'.length) : null
}

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
  if (process.env.VERCEL && databaseBackend === 'file') {
    console.warn(
      'Setflow is using an ephemeral /tmp SQLite file. Add GITHUB_DATABASE_TOKEN or TURSO_DATABASE_URL so songs stay saved.',
    )
  }
  return new PrismaClient({
    datasources: { db: { url } },
  })
}

export let prisma = createPrisma()
export let sqliteFilePath = remote ? null : sqlitePathFromUrl(process.env.DATABASE_URL || fileDatabaseUrl())

export function recreateFilePrisma() {
  prisma = createPrisma()
  sqliteFilePath = sqlitePathFromUrl(process.env.DATABASE_URL || fileDatabaseUrl())
  return prisma
}
