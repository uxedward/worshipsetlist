import { PrismaClient } from '@prisma/client'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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

function databaseUrl() {
  const bundled = findBundledDb()
  if (process.env.VERCEL) {
    const dest = '/tmp/setflow.db'
    if (bundled) {
      fs.copyFileSync(bundled, dest)
      return `file:${dest}`
    }
    console.error('SQLite file missing. cwd=', process.cwd(), 'here=', here)
  }
  if (bundled) return `file:${bundled}`
  return process.env.DATABASE_URL || 'file:./setflow.db'
}

const url = databaseUrl()
process.env.DATABASE_URL = url

export const prisma = new PrismaClient({
  datasources: { db: { url } },
})
