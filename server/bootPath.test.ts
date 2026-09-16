import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

function src(name: string) {
  return readFileSync(new URL(name, import.meta.url), 'utf8')
}

describe('boot path', () => {
  it('keeps /api/health to a single database ping', () => {
    const index = src('./index.ts')
    expect(index).toContain('SELECT 1')
    expect(index).not.toMatch(/customBackground\.count/)
  })

  it('does not resolve the session cookie on health pings', () => {
    expect(src('./authMiddleware.ts')).toContain("path === '/api/health'")
  })

  it('does not recount users on every anonymous /api/auth/state', () => {
    const auth = src('./routes/auth.ts')
    expect(auth).toContain('if (accountsExist)')
    expect(auth).toContain('accountsExist = count > 0')
  })

  it('defers the Present video service worker until after first paint', () => {
    expect(src('../client/src/main.tsx')).not.toContain('installPresentVideoSw')
    expect(src('../client/src/App.tsx')).toContain('requestBootstrap')
    expect(src('../client/src/App.tsx')).toContain('loadAppInner')
  })
})
