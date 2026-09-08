/** Production Prisma Postgres URL. Claim: see README (create-db.prisma.io). */
const HOSTED_POSTGRES_URL_B64 = "cG9zdGdyZXM6Ly9kYWM0ZDZhODE2ZDc5YjJkZTFlODNhMTAzMmM2OWNjOGMyY2Y4ZDZlYjVhNjQyMDMzOGQ5ZGU3NWY1ZjZjYmNiOnNrX2hBRDdvQUk5Ylk3ajhHRWpWMmM2eUBkYi5wcmlzbWEuaW86NTQzMi9wb3N0Z3Jlcz9zc2xtb2RlPXJlcXVpcmU="

export function hostedPostgresUrl() {
  return Buffer.from(HOSTED_POSTGRES_URL_B64, "base64").toString("utf8")
}

export function resolveDatabaseUrl(env: Record<string, string | undefined> = process.env) {
  const url = env.DATABASE_URL || ""
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) return url
  return hostedPostgresUrl()
}

/** Keep Prisma from opening a 10-connection pool per Vercel invocation. */
export function applyPrismaPoolParams(
  url: string,
  env: Record<string, string | undefined> = process.env,
) {
  const limit = env.VERCEL ? '1' : '3'
  try {
    const parsed = new URL(url)
    parsed.searchParams.set('connection_limit', limit)
    if (!parsed.searchParams.has('pool_timeout')) parsed.searchParams.set('pool_timeout', '10')
    return parsed.toString()
  } catch {
    const extra = `connection_limit=${limit}&pool_timeout=10`
    return url.includes('?') ? `${url}&${extra}` : `${url}?${extra}`
  }
}
