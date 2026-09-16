import { afterEach, describe, expect, it } from 'vitest'
import { AUTH_CACHE_KEY, readAuthCache, writeAuthCache } from './authCache.ts'

const memory = new Map<string, string>()
Object.defineProperty(globalThis, 'sessionStorage', {
  value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value)
    },
    removeItem: (key: string) => {
      memory.delete(key)
    },
    clear: () => memory.clear(),
  },
})

afterEach(() => {
  memory.clear()
})

describe('authCache', () => {
  it('round-trips first-run setup so the create-admin screen paints immediately', () => {
    writeAuthCache({ needsSetup: true, user: null })
    expect(readAuthCache()).toEqual({ needsSetup: true, user: null })
  })

  it('round-trips a signed-in user', () => {
    const user = { id: 'u1', email: 'lead@church.org', name: 'Lead', role: 'admin' as const }
    writeAuthCache({ needsSetup: false, user })
    expect(readAuthCache()).toEqual({ needsSetup: false, user })
  })

  it('ignores a malformed payload', () => {
    sessionStorage.setItem(AUTH_CACHE_KEY, '{not json')
    expect(readAuthCache()).toBeUndefined()
  })
})
