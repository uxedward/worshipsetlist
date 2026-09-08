import { PrismaClient } from '@prisma/client'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyPrismaPoolParams, resolveDatabaseUrl } from './hostedDatabase.ts'

const here = path.dirname(fileURLToPath(import.meta.url))

export type DatabaseBackend = 'postgres'

export function findBundledDb() {
  const candidates = [
    path.join(here, '../prisma/setflow.db'),
    path.join(process.cwd(), 'prisma/setflow.db'),
    path.join(process.cwd(), 'setflow.db'),
    '/var/task/prisma/setflow.db',
    '/var/task/setflow.db',
  ]
  return candidates.find((file) => {
    try {
      return fs.statSync(file).isFile()
    } catch {
      return false
    }
  })
}

const url = applyPrismaPoolParams(resolveDatabaseUrl())
process.env.DATABASE_URL = url

export const databaseBackend: DatabaseBackend = 'postgres'
export const durableDatabase = true
export const sqliteFilePath: string | null = null

const globalForPrisma = globalThis as unknown as { setflowPrisma?: PrismaClient }

export const prisma =
  globalForPrisma.setflowPrisma ??
  new PrismaClient({
    datasources: { db: { url } },
  })
globalForPrisma.setflowPrisma = prisma

export function recreateFilePrisma() {
  return prisma
}
