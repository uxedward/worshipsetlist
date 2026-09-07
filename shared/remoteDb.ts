export type RemoteSqlite = {
  url: string
  authToken?: string
}

export function isLibsqlUrl(url: string): boolean {
  if (!url) return false
  if (url.startsWith('libsql://') || url.startsWith('wss://')) return true
  return url.startsWith('https://') && url.includes('.turso.io')
}

export function remoteSqliteFromEnv(env: Record<string, string | undefined> = process.env): RemoteSqlite | null {
  const token = env.TURSO_AUTH_TOKEN || env.LIBSQL_AUTH_TOKEN || undefined
  const dedicated = env.TURSO_DATABASE_URL || env.LIBSQL_DATABASE_URL || ''
  if (isLibsqlUrl(dedicated)) return { url: dedicated, authToken: token }
  const databaseUrl = env.DATABASE_URL || ''
  if (isLibsqlUrl(databaseUrl)) return { url: databaseUrl, authToken: token }
  return null
}
