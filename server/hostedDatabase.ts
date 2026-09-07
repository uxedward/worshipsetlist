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
