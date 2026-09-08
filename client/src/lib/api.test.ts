import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  HEALTH_FAILS_BEFORE_OFFLINE,
  HEALTH_GRACE_MS,
  api,
  isOnline,
  pingHealth,
  resetConnectionStateForTests,
} from './api.ts'

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: { get: () => 'application/json' },
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

describe('pingHealth', () => {
  beforeEach(() => {
    resetConnectionStateForTests()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ ok: true })),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetConnectionStateForTests()
  })

  it('stays online after a single failed health ping', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ok: false }, 503) as never)
    await expect(pingHealth()).resolves.toBe(false)
    expect(isOnline()).toBe(true)
  })

  it('goes offline after consecutive failed health pings', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: false }, 503) as never)
    for (let i = 0; i < HEALTH_FAILS_BEFORE_OFFLINE; i++) {
      await pingHealth()
    }
    expect(isOnline()).toBe(false)
  })

  it('ignores health misses shortly after a successful API call', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ id: 1 }, 200) as never)
    await api('/api/preferences')
    expect(isOnline()).toBe(true)

    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: false }, 503) as never)
    for (let i = 0; i < HEALTH_FAILS_BEFORE_OFFLINE + 1; i++) {
      await pingHealth()
    }
    expect(isOnline()).toBe(true)
    expect(HEALTH_GRACE_MS).toBeGreaterThan(0)
  })

  it('does not treat a flush-style API error as offline when health recovers', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ok: false }, 503) as never)
    await pingHealth()
    expect(isOnline()).toBe(true)

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ imported: 0 }, 200) as never)
    await api('/api/songs/sync-local', { method: 'POST', json: { songs: [] } })
    expect(isOnline()).toBe(true)

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ok: false }, 503) as never)
    await pingHealth()
    expect(isOnline()).toBe(true)
  })

  it('marks offline immediately when the browser has no network', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(pingHealth()).resolves.toBe(false)
    expect(isOnline()).toBe(false)
  })
})
