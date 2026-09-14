export function skipDatabasePrepare(method: string | undefined, url: string | undefined) {
  const path = (url || '').split('?')[0]
  if (path === '/api/health') return true
  if (path === '/api/backgrounds' || path.startsWith('/api/backgrounds/')) return true
  return false
}

export function needsDatabasePrepare(err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  return /does not exist|unknown (arg|field|model)|relation .* does not exist/i.test(message)
}
