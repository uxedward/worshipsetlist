/** Last-resort Prisma Postgres URL. Prefer Vercel/Supabase env vars instead. */
const HOSTED_POSTGRES_URL_B64 =
  'cG9zdGdyZXM6Ly9kYWM0ZDZhODE2ZDc5YjJkZTFlODNhMTAzMmM2OWNjOGMyY2Y4ZDZlYjVhNjQyMDMzOGQ5ZGU3NWY1ZjZjYmNiOnNrX2hBRDdvQUk5Ylk3ajhHRWpWMmM2eUBkYi5wcmlzbWEuaW86NTQzMi9wb3N0Z3Jlcz9zc2xtb2RlPXJlcXVpcmU='

const POSTGRES_ENV_KEYS = [
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL',
  'DATABASE_URL',
  'POSTGRES_URL_NON_POOLING',
  'DIRECT_URL',
] as const

export function hostedPostgresUrl() {
  return Buffer.from(HOSTED_POSTGRES_URL_B64, 'base64').toString('utf8')
}

function isPostgresUrl(url: string | undefined): url is string {
  return Boolean(url && (url.startsWith('postgres://') || url.startsWith('postgresql://')))
}

export function postgresHost(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

export function isPrismaHostedUrl(url: string): boolean {
  const host = postgresHost(url)
  return host === 'db.prisma.io' || host.endsWith('.prisma.io')
}

export function databaseVendor(url: string): 'supabase' | 'prisma' | 'neon' | 'postgres' {
  const host = postgresHost(url)
  if (host.includes('supabase')) return 'supabase'
  if (host.includes('prisma.io')) return 'prisma'
  if (host.includes('neon.tech') || host.includes('neon.')) return 'neon'
  return 'postgres'
}

function postgresCandidates(env: Record<string, string | undefined>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const key of POSTGRES_ENV_KEYS) {
    const url = env[key]
    if (!isPostgresUrl(url) || seen.has(url)) continue
    seen.add(url)
    out.push(url)
  }
  return out
}

/** Prefer a Vercel/Supabase Postgres URL over the paused Prisma-hosted database. */
export function resolveDatabaseUrl(env: Record<string, string | undefined> = process.env) {
  const candidates = postgresCandidates(env)
  const preferred = candidates.find((url) => !isPrismaHostedUrl(url))
  if (preferred) return preferred
  if (candidates[0]) return candidates[0]
  return hostedPostgresUrl()
}

function needsPgBouncer(parsed: URL): boolean {
  return parsed.port === '6543' || parsed.hostname.includes('pooler.supabase.com')
}

/** Keep Prisma from opening a 10-connection pool per Vercel invocation. */
export function applyPrismaPoolParams(
  url: string,
  env: Record<string, string | undefined> = process.env,
) {
  const limit = env.VERCEL ? '5' : '3'
  try {
    const parsed = new URL(url)
    parsed.searchParams.set('connection_limit', limit)
    if (!parsed.searchParams.has('pool_timeout')) parsed.searchParams.set('pool_timeout', '10')
    if (needsPgBouncer(parsed) && !parsed.searchParams.has('pgbouncer')) {
      parsed.searchParams.set('pgbouncer', 'true')
    }
    if (parsed.hostname.includes('supabase') && !parsed.searchParams.has('sslmode')) {
      parsed.searchParams.set('sslmode', 'require')
    }
    return parsed.toString()
  } catch {
    const extra = `connection_limit=${limit}&pool_timeout=10`
    return url.includes('?') ? `${url}&${extra}` : `${url}?${extra}`
  }
}
