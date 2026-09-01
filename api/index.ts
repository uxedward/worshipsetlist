import type { IncomingMessage, ServerResponse } from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body, null, 2))
}

function listDir(dir: string) {
  try {
    return fs.readdirSync(dir)
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}

function requestPath(req: IncomingMessage) {
  return (
    header(req, 'x-invoke-path') ||
    header(req, 'x-forwarded-uri') ||
    req.url ||
    ''
  )
}

function header(req: IncomingMessage, name: string) {
  const value = req.headers[name]
  return Array.isArray(value) ? value[0] : value
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = requestPath(req)
  if (url.includes('/api/debug') || url.includes('debug=1')) {
    sendJson(res, 200, {
      cwd: process.cwd(),
      url: req.url,
      resolvedUrl: url,
      vercel: process.env.VERCEL || null,
      databaseUrl: process.env.DATABASE_URL || null,
      task: listDir('/var/task'),
      prisma: listDir('/var/task/prisma'),
      api: listDir('/var/task/api'),
      server: listDir('/var/task/server'),
      serverRoutes: listDir('/var/task/server/routes'),
      shared: listDir('/var/task/shared'),
      prismaClient: listDir('/var/task/node_modules/.prisma/client'),
      cwdPrisma: listDir(path.join(process.cwd(), 'prisma')),
    })
    return
  }

  try {
    const { app } = await import('../server/index.js')
    return app(req as never, res as never)
  } catch (err) {
    sendJson(res, 500, {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
  }
}
