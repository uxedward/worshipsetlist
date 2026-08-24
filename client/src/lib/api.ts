export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

type ConnListener = (online: boolean) => void
const connListeners = new Set<ConnListener>()

let online = true

export function isOnline(): boolean {
  return online
}

export function onConnectionChange(cb: ConnListener): () => void {
  connListeners.add(cb)
  return () => connListeners.delete(cb)
}

function setOnline(next: boolean) {
  if (online === next) return
  online = next
  connListeners.forEach((cb) => cb(next))
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

export async function flushQueue(): Promise<void> {
  while (queue.length > 0) {
    const item = queue[0]
    const path = remapPath(item.path)
    const body = remapBody(item.body)
    const result = await api<Record<string, unknown>>(path, {
      method: item.method,
      body: body === undefined ? undefined : JSON.stringify(body),
      skipQueue: true,
    })
    if (item.body && typeof item.body === 'object' && 'id' in item.body && result && typeof result === 'object' && 'id' in result) {
      const temp = String((item.body as { id?: string }).id)
      const real = String(result.id)
      if (temp && real && temp !== real) idMap.set(temp, real)
    }
    queue.shift()
  }
}

type ApiInit = RequestInit & { skipQueue?: boolean; queueOnFail?: boolean; json?: unknown }

export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const { skipQueue, queueOnFail, json, ...rest } = init
  const headers = new Headers(rest.headers)
  if (json !== undefined) headers.set('Content-Type', 'application/json')
  try {
    const res = await fetch(path, {
      ...rest,
      headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    })
    setOnline(true)
    if (!res.ok) {
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
    setOnline(false)
    if (queueOnFail && !skipQueue) {
      enqueue({
        path,
        method: (rest.method || 'GET').toUpperCase(),
        body: json,
      })
    }
    throw err
  }
}

export async function pingHealth(): Promise<boolean> {
  try {
    const res = await fetch('/api/health', { cache: 'no-store' })
    const ok = res.ok
    setOnline(ok)
    return ok
  } catch {
    setOnline(false)
    return false
  }
}

export const endpoints = {
  health: () => api<{ ok: boolean }>('/api/health'),
  prefs: () => api<import('@shared/types.ts').Preference>('/api/preferences'),
  patchPrefs: (body: Record<string, unknown>) =>
    api('/api/preferences', { method: 'PATCH', json: body, queueOnFail: true }),
  setlists: () => api<import('@shared/types.ts').Setlist[]>('/api/setlists'),
  setlist: (id: string) => api<import('@shared/types.ts').Setlist>(`/api/setlists/${id}`),
  createSetlist: (body: Record<string, unknown>) =>
    api('/api/setlists', { method: 'POST', json: body, queueOnFail: true }),
  patchSetlist: (id: string, body: Record<string, unknown>) =>
    api(`/api/setlists/${id}`, { method: 'PATCH', json: body, queueOnFail: true }),
  deleteSetlist: (id: string) =>
    api(`/api/setlists/${id}`, { method: 'DELETE', queueOnFail: true }),
  duplicateSetlist: (id: string) =>
    api(`/api/setlists/${id}/duplicate`, { method: 'POST', json: {}, queueOnFail: true }),
  addSongToSetlist: (setlistId: string, songId: string) =>
    api<import('@shared/types.ts').SetlistSong>(`/api/setlists/${setlistId}/songs`, {
      method: 'POST',
      json: { songId },
      queueOnFail: true,
    }),
  patchSetlistSong: (setlistId: string, ssId: string, body: Record<string, unknown>) =>
    api(`/api/setlists/${setlistId}/songs/${ssId}`, { method: 'PATCH', json: body, queueOnFail: true }),
  removeSetlistSong: (setlistId: string, ssId: string) =>
    api(`/api/setlists/${setlistId}/songs/${ssId}`, { method: 'DELETE', queueOnFail: true }),
  reorder: (setlistId: string, orderedIds: string[]) =>
    api(`/api/setlists/${setlistId}/reorder`, { method: 'PUT', json: { orderedIds }, queueOnFail: true }),
  songs: (q: string) => api<import('@shared/types.ts').Song[]>(`/api/songs${q}`),
  song: (id: string) => api<import('@shared/types.ts').Song>(`/api/songs/${id}`),
  createSong: (body: unknown) =>
    api('/api/songs', { method: 'POST', json: body, queueOnFail: true }),
  patchSong: (id: string, body: unknown) =>
    api(`/api/songs/${id}`, { method: 'PATCH', json: body, queueOnFail: true }),
  deleteSong: (id: string) =>
    api(`/api/songs/${id}`, { method: 'DELETE', queueOnFail: true }),
  bulkImport: (text: string) =>
    api<{ imported: number; skipped: number; message: string }>('/api/songs/bulk-import', {
      method: 'POST',
      json: { text },
    }),
  exportSongs: () => api<string>('/api/songs/export'),
}
