import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  HEALTH_FAILS_BEFORE_OFFLINE,
  HEALTH_GRACE_MS,
  api,
  discardBootstrapInflight,
  enqueue,
  flushQueue,
  isOnline,
  isQueueParked,
  onAuthLost,
  pendingCount,
  pingHealth,
  releaseQueue,
  requestBootstrap,
  resetConnectionStateForTests,
  resetQueueForTests,
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

describe('offline queue under authentication', () => {
  beforeEach(() => {
    resetConnectionStateForTests()
    resetQueueForTests()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetConnectionStateForTests()
    resetQueueForTests()
  })

  it('parks the queue on a 401 rather than spinning on the same item', async () => {
    const onLost = vi.fn()
    const stop = onAuthLost(onLost)
    enqueue({ path: '/api/songs', method: 'GET' })
    enqueue({ path: '/api/setlists', method: 'GET' })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 'Sign in to continue.' }, 401)),
    )

    await flushQueue()

    // The failing item is still first in line, and nothing behind it was tried.
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(pendingCount()).toBe(2)
    expect(isQueueParked()).toBe(true)
    expect(onLost).toHaveBeenCalled()

    // A parked queue stays parked until a sign-in releases it.
    await flushQueue()
    expect(fetch).toHaveBeenCalledTimes(1)

    releaseQueue()
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true }, 200) as never)
    await flushQueue()
    expect(pendingCount()).toBe(0)
    stop()
  })

  it('drops a queued call this account may never make, instead of replaying it', async () => {
    enqueue({ path: '/api/songs/abc', method: 'GET' })
    enqueue({ path: '/api/setlists', method: 'GET' })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'admins only' }, 403))
      .mockResolvedValueOnce(jsonResponse({ ok: true }, 200))
    vi.stubGlobal('fetch', fetchMock)

    await flushQueue()

    expect(pendingCount()).toBe(0)
    expect(isQueueParked()).toBe(false)
  })

  it('reports a lost session from an ordinary call', async () => {
    const onLost = vi.fn()
    const stop = onAuthLost(onLost)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 'Sign in to continue.' }, 401)),
    )
    await expect(api('/api/bootstrap')).rejects.toThrow()
    expect(onLost).toHaveBeenCalledTimes(1)
    stop()
  })

  it('does not report a lost session for a failed sign-in attempt', async () => {
    const onLost = vi.fn()
    const stop = onAuthLost(onLost)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 'That email and password do not match.' }, 401)),
    )
    await expect(
      api('/api/auth/login', { method: 'POST', json: {}, skipAuthNotify: true }),
    ).rejects.toThrow()
    expect(onLost).not.toHaveBeenCalled()
    stop()
  })
})

describe('requestBootstrap', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    discardBootstrapInflight()
  })

  it('shares one in-flight library request', async () => {
    const payload = { preferences: { id: 1 }, setlists: [], songs: [], activeSetlist: null }
    const fetchMock = vi.fn(async () => jsonResponse(payload))
    vi.stubGlobal('fetch', fetchMock)
    const [a, b] = await Promise.all([requestBootstrap(), requestBootstrap()])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(a).toEqual(payload)
    expect(b).toEqual(payload)
    await expect(requestBootstrap()).resolves.toEqual(payload)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
