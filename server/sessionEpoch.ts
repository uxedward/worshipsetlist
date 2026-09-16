import { prisma } from './db.ts'

/**
 * Cached so authorization stays query-free on the hot path. A serverless
 * isolate re-reads at most once a minute, which bounds how long a revoked
 * session keeps working.
 */
const CACHE_MS = 60_000

let cached: { value: number; readAt: number } | null = null

export function resetSessionEpochCache() {
  cached = null
}

/** null means "could not read it" — callers skip the check rather than guess. */
export async function currentSessionEpoch(): Promise<number | null> {
  if (cached && Date.now() - cached.readAt < CACHE_MS) return cached.value
  try {
    // Read-only on the hot path. An upsert here used to write AuthSetting on
    // every request, including sign-in, and hung when the table was missing.
    const row = await prisma.authSetting.findUnique({ where: { id: 1 } })
    if (!row) return cached?.value ?? null
    cached = { value: row.sessionEpoch, readAt: Date.now() }
    return row.sessionEpoch
  } catch {
    // A database blip must not sign the whole team out mid-service. Reuse the
    // last known epoch, or waive the check until the database answers again.
    return cached?.value ?? null
  }
}

/** The epoch to stamp on a new cookie. Writing one is worth a real read. */
export async function issuingSessionEpoch(): Promise<number> {
  try {
    const row = await prisma.authSetting.upsert({
      where: { id: 1 },
      create: { id: 1, sessionEpoch: 1 },
      update: {},
    })
    cached = { value: row.sessionEpoch, readAt: Date.now() }
    return row.sessionEpoch
  } catch {
    return (await currentSessionEpoch()) ?? 1
  }
}

/** Invalidates every issued cookie. Used when a user is removed or demoted. */
export async function bumpSessionEpoch(): Promise<number> {
  const row = await prisma.authSetting.upsert({
    where: { id: 1 },
    create: { id: 1, sessionEpoch: 2 },
    update: { sessionEpoch: { increment: 1 } },
  })
  cached = { value: row.sessionEpoch, readAt: Date.now() }
  return row.sessionEpoch
}
