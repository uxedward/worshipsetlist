export function skipDatabasePrepare(method: string | undefined, url: string | undefined) {
  const path = (url || '').split('?')[0]
  const verb = (method || 'GET').toUpperCase()
  if (path === '/api/health') return true
  if (path === '/api/backgrounds' || path.startsWith('/api/backgrounds/')) return true
  if (verb !== 'GET' && verb !== 'HEAD') return false
  if (path === '/api/bootstrap' || path === '/api/preferences') return true
  if (path === '/api/songs' || path.startsWith('/api/songs/')) return true
  if (path === '/api/setlists' || path.startsWith('/api/setlists/')) return true
  return false
}

export function needsDatabasePrepare(err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  return /does not exist|unknown (arg|field|model)|relation .* does not exist/i.test(message)
}
