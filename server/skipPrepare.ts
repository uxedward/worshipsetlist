export function skipDatabasePrepare(method: string | undefined, url: string | undefined) {
  const path = (url || '').split('?')[0]
  if (path === '/api/health') return true
  const verb = (method || 'GET').toUpperCase()
  if (verb === 'GET' && /^\/api\/backgrounds\/media\/[^/]+$/.test(path)) return true
  return false
}

export function needsDatabasePrepare(err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  return /does not exist|unknown (arg|field|model)|relation .* does not exist/i.test(message)
}
