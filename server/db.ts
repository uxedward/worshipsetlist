import { PrismaClient } from '@prisma/client'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const schemaDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../prisma')
const bundledDb = path.join(schemaDir, 'setflow.db')

function databaseUrl() {
  if (process.env.VERCEL) {
    const dest = '/tmp/setflow.db'
    if (fs.existsSync(bundledDb)) {
      fs.copyFileSync(bundledDb, dest)
    }
    return `file:${dest}`
  }
  return process.env.DATABASE_URL || `file:${bundledDb}`
}

export const prisma = new PrismaClient({
  datasources: { db: { url: databaseUrl() } },
})
