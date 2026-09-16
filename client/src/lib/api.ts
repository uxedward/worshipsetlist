export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

type ConnListener = (online: boolean) => void
const connListeners = new Set<ConnListener>()

type AuthListener = () => void
const authListeners = new Set<AuthListener>()

/** Fires when the API says the session is gone, so the app can show sign-in. */
export function onAuthLost(cb: AuthListener): () => void {
  authListeners.add(cb)
  return () => authListeners.delete(cb)
}

function notifyAuthLost() {
  authListeners.forEach((cb) => cb())
}

/** One missed /api/health ping is not enough to show the offline banner. */
export const HEALTH_FAILS_BEFORE_OFFLINE = 2
/** After a real API response, ignore health blips for this long. */
export const HEALTH_GRACE_MS = 60_000

let online = true
let healthFailStreak = 0
let lastSuccessAt = 0

export function isOnline(): boolean {
  return online
}

export function onConnectionChange(cb: ConnListener): () => void {
  connListeners.add(cb)
  return () => connListeners.delete(cb)
}

function setOnline(next: boolean) {
  if (next) {
    healthFailStreak = 0
    lastSuccessAt = Date.now()
  }
  if (online === next) return
  online = next
  connListeners.forEach((cb) => cb(next))
}

function noteHealthResult(ok: boolean): boolean {
  if (ok) {
    setOnline(true)
    return true
  }
  healthFailStreak += 1
  const recentlyOk = lastSuccessAt > 0 && Date.now() - lastSuccessAt < HEALTH_GRACE_MS
  if (healthFailStreak >= HEALTH_FAILS_BEFORE_OFFLINE && !recentlyOk) setOnline(false)
  return false
}

export function resetConnectionStateForTests() {
  online = true
  healthFailStreak = 0
  lastSuccessAt = 0
}

export type QueuedRequest = {
  id: string
  path: string
  method: string
  body?: unknown
}

const queue: QueuedRequest[] = []
const idMap = new Map<string, string>()

export function pendingCount(): number {
  return queue.length
}

export function enqueue(req: Omit<QueuedRequest, 'id'>): void {
  queue.push({ ...req, id: `${Date.now()}-${Math.random()}` })
}

function remapPath(path: string): string {
  let next = path
  idMap.forEach((real, temp) => {
    next = next.replaceAll(temp, real)
  })
  return next
}

function remapBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body
  const json = JSON.stringify(body)
  let next = json
  idMap.forEach((real, temp) => {
    next = next.replaceAll(temp, real)
  })
  return JSON.parse(next)
}

/** Set while the queue is parked on a 401 so a re-login can release it. */
let queueParked = false

export function isQueueParked(): boolean {
  return queueParked
}

export function releaseQueue(): void {
  queueParked = false
}

export function resetQueueForTests(): void {
  queue.length = 0
  idMap.clear()
  queueParked = false
}

export async function flushQueue(): Promise<void> {
  if (queueParked) return
  while (queue.length > 0) {
    const item = queue[0]
    const path = remapPath(item.path)
    const body = remapBody(item.body)
    let result: Record<string, unknown>
    try {
      result = await api<Record<string, unknown>>(path, {
        method: item.method,
        body: body === undefined ? undefined : JSON.stringify(body),
        skipQueue: true,
      })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Signing back in releases the queue. Retrying now would just spin on
        // the same item and block every write behind it.
        queueParked = true
        notifyAuthLost()
        return
      }
      if (err instanceof ApiError && err.status === 403) {
        // This account will never be allowed to make that call. Drop it rather
        // than replay it forever.
        queue.shift()
        continue
      }
      throw err
    }
    if (item.body && typeof item.body === 'object' && 'id' in item.body && result && typeof result === 'object' && 'id' in result) {
      const temp = String((item.body as { id?: string }).id)
      const real = String(result.id)
      if (temp && real && temp !== real) idMap.set(temp, real)
    }
    queue.shift()
  }
}

type ApiInit = RequestInit & {
  skipQueue?: boolean
  queueOnFail?: boolean
  json?: unknown
  /** Set on the sign-in calls, whose 401 is an answer rather than a lost session. */
  skipAuthNotify?: boolean
}

export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const { skipQueue, queueOnFail, json, skipAuthNotify, ...rest } = init
  const headers = new Headers(rest.headers)
  if (json !== undefined) headers.set('Content-Type', 'application/json')
  try {
    const res = await fetch(path, {
      ...rest,
      headers,
      credentials: 'same-origin',
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    })
    const ok = res.ok
    setOnline(true)
    if (res.status === 401 && !skipAuthNotify) notifyAuthLost()
    if (!ok) {
      let message = res.statusText
      try {
        const data = (await res.json()) as { error?: string }
        if (data.error) message = data.error
      } catch {
        /* ignore */
      }
      throw new ApiError(message, res.status)
    }
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('text/plain')) return (await res.text()) as T
    if (res.status === 204) return undefined as T
    const text = await res.text()
    if (!text) return undefined as T
    return JSON.parse(text) as T
  } catch (err) {
    if (err instanceof ApiError) throw err
    const method = (rest.method || 'GET').toUpperCase()
    if (queueOnFail && !skipQueue && (method === 'GET' || method === 'HEAD')) {
      enqueue({
        path,
        method,
        body: json,
      })
    }
    throw err
  }
}

export async function pingHealth(): Promise<boolean> {
  try {
    const res = await fetch('/api/health', { cache: 'no-store' })
    return noteHealthResult(res.ok)
  } catch {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      healthFailStreak = HEALTH_FAILS_BEFORE_OFFLINE
      setOnline(false)
      return false
    }
    return noteHealthResult(false)
  }
}

export type Role = 'admin' | 'user'

export interface AccountUser {
  id: string
  email: string
  name: string
  role: Role
}

export interface ManagedUser extends AccountUser {
  createdAt: string
}

export const endpoints = {
  authState: () =>
    api<{ needsSetup: boolean; user: AccountUser | null }>('/api/auth/state', { skipAuthNotify: true }),
  login: (email: string, password: string) =>
    api<{ user: AccountUser }>('/api/auth/login', {
      method: 'POST',
      json: { email, password },
      skipAuthNotify: true,
    }),
  setupAdmin: (body: { email: string; password: string; name?: string }) =>
    api<{ user: AccountUser }>('/api/auth/setup', { method: 'POST', json: body, skipAuthNotify: true }),
  logout: () => api<{ ok: boolean }>('/api/auth/logout', { method: 'POST', skipAuthNotify: true }),
  changePassword: (currentPassword: string, password: string) =>
    api<{ ok: boolean }>('/api/auth/password', {
      method: 'POST',
      json: { currentPassword, password },
      skipAuthNotify: true,
    }),
  updateProfile: (name: string) =>
    api<{ user: AccountUser }>('/api/auth/me', { method: 'PATCH', json: { name } }),
  checkResetToken: (token: string) =>
    api<{ email: string; name: string }>(`/api/auth/reset/${encodeURIComponent(token)}`, {
      skipAuthNotify: true,
    }),
  completeReset: (token: string, password: string) =>
    api<{ user: AccountUser }>(`/api/auth/reset/${encodeURIComponent(token)}`, {
      method: 'POST',
      json: { password },
      skipAuthNotify: true,
    }),
  createResetLink: (id: string) =>
    api<{ email: string; link: string; expiresAt: string }>(`/api/auth/users/${id}/reset`, {
      method: 'POST',
      json: {},
    }),
  listUsers: () => api<ManagedUser[]>('/api/auth/users'),
  createUser: (body: { email: string; password: string; name?: string; role: Role }) =>
    api<ManagedUser>('/api/auth/users', { method: 'POST', json: body }),
  updateUser: (id: string, body: { name?: string; role?: Role; password?: string }) =>
    api<ManagedUser>(`/api/auth/users/${id}`, { method: 'PATCH', json: body }),
  deleteUser: (id: string) => api<{ ok: boolean }>(`/api/auth/users/${id}`, { method: 'DELETE' }),
  health: () => api<{ ok: boolean; songs?: number; durable?: boolean; backend?: string }>('/api/health'),
  bootstrap: () =>
    api<{
      preferences: import('@shared/types.ts').Preference
      setlists: import('@shared/types.ts').Setlist[]
      songs: import('@shared/types.ts').Song[]
      activeSetlist: import('@shared/types.ts').Setlist | null
    }>('/api/bootstrap'),
  prefs: () => api<import('@shared/types.ts').Preference>('/api/preferences'),
  patchPrefs: (body: Record<string, unknown>) =>
    api('/api/preferences', { method: 'PATCH', json: body }),
  setlists: () => api<import('@shared/types.ts').Setlist[]>('/api/setlists'),
  setlist: (id: string) => api<import('@shared/types.ts').Setlist>(`/api/setlists/${id}`),
  createSetlist: (body: Record<string, unknown>) =>
    api('/api/setlists', { method: 'POST', json: body }),
  patchSetlist: (id: string, body: Record<string, unknown>) =>
    api(`/api/setlists/${id}`, { method: 'PATCH', json: body }),
  deleteSetlist: (id: string) =>
    api(`/api/setlists/${id}`, { method: 'DELETE' }),
  duplicateSetlist: (id: string) =>
    api(`/api/setlists/${id}/duplicate`, { method: 'POST', json: {} }),
  addSongToSetlist: (setlistId: string, songId: string) =>
    api<import('@shared/types.ts').SetlistSong>(`/api/setlists/${setlistId}/songs`, {
      method: 'POST',
      json: { songId },
    }),
  patchSetlistSong: (setlistId: string, ssId: string, body: Record<string, unknown>) =>
    api(`/api/setlists/${setlistId}/songs/${ssId}`, { method: 'PATCH', json: body }),
  removeSetlistSong: (setlistId: string, ssId: string) =>
    api(`/api/setlists/${setlistId}/songs/${ssId}`, { method: 'DELETE' }),
  reorder: (setlistId: string, orderedIds: string[]) =>
    api(`/api/setlists/${setlistId}/reorder`, { method: 'PUT', json: { orderedIds } }),
  reorderSetlists: (orderedIds: string[]) =>
    api('/api/setlists/reorder', { method: 'PUT', json: { orderedIds } }),
  songs: (q: string) => api<import('@shared/types.ts').Song[]>(`/api/songs${q}`),
  song: (id: string) => api<import('@shared/types.ts').Song>(`/api/songs/${id}`),
  createSong: (body: unknown) =>
    api('/api/songs', { method: 'POST', json: body }),
  patchSong: (id: string, body: unknown) =>
    api(`/api/songs/${id}`, { method: 'PATCH', json: body }),
  deleteSong: (id: string) =>
    api(`/api/songs/${id}`, { method: 'DELETE' }),
  bulkImport: (text: string) =>
    api<{ imported: number; skipped: number; message: string }>('/api/songs/bulk-import', {
      method: 'POST',
      json: { text },
    }),
  spotifyLookup: (url: string) =>
    api<{ kind: string; name: string; tracks: { title: string; artist: string; durationSeconds: number | null }[] }>(
      '/api/songs/spotify-lookup',
      { method: 'POST', json: { url } },
    ),
  exportSongs: () => api<string>('/api/songs/export'),
  syncLocalSongs: (songs: unknown[]) =>
    api<{ imported: number; skipped: number; durable: boolean }>('/api/songs/sync-local', {
      method: 'POST',
      json: { songs },
    }),
  backgrounds: () =>
    api<{
      backgrounds: import('../lib/presentBackgrounds.ts').PresentBackground[]
      pending?: Array<{ id: string; label: string; sizeBytes: number; poster?: string }>
      hostingEnabled: boolean
      blobEnabled: boolean
      supabaseEnabled: boolean
      provider: 'database' | 'blob' | 'supabase' | 'local' | 'none'
    }>('/api/backgrounds'),
  createBackgroundUpload: (body: { id: string; filename: string; contentType: string; chunkIndex?: number }) =>
    api<{ uploadUrl: string; publicUrl: string; token?: string }>('/api/backgrounds/upload', {
      method: 'POST',
      json: body,
    }),
  createBackground: (body: {
    id?: string
    label: string
    src: string
    poster?: string
    sizeBytes?: number
    mimeType?: string
  }) =>
    api<import('../lib/presentBackgrounds.ts').PresentBackground>('/api/backgrounds', {
      method: 'POST',
      json: body,
    }),
  deleteBackground: (id: string) => api(`/api/backgrounds/${id}`, { method: 'DELETE' }),
}
