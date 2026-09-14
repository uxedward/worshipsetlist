import { createWriteStream, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { IncomingMessage } from 'node:http'

export const PRESENT_VIDEO_BUCKET = 'present-videos'
export const MAX_PRESENT_VIDEO_BYTES = 1024 * 1024 * 1024

export type VideoHostingProvider = 'database' | 'blob' | 'supabase' | 'local' | 'none'

export type VideoHostingStatus = {
  provider: VideoHostingProvider
  blobEnabled: boolean
  supabaseEnabled: boolean
  hostingEnabled: boolean
}

type Env = Record<string, string | undefined>

export function supabaseConfig(env: Env = process.env) {
  const url = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(
    /\/$/,
    '',
  )
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || ''
  if (!url || !key) return null
  return { url, key }
}

export function videoHostingStatus(env: Env = process.env): VideoHostingStatus {
  const blobEnabled = Boolean(env.BLOB_READ_WRITE_TOKEN)
  const supabaseEnabled = Boolean(supabaseConfig(env))
  return {
    provider: 'database',
    blobEnabled,
    supabaseEnabled,
    hostingEnabled: true,
  }
}

export function isBlobUploadBody(body: unknown) {
  return Boolean(
    body &&
      typeof body === 'object' &&
      'type' in body &&
      typeof (body as { type?: unknown }).type === 'string' &&
      String((body as { type: string }).type).includes('blob'),
  )
}

export function localVideoDir() {
  return path.resolve(process.cwd(), 'data/present-videos')
}

export function sanitizeBackgroundId(id: string) {
  const trimmed = id.trim()
  if (!/^custom-[a-zA-Z0-9-]+$/.test(trimmed)) {
    throw new Error('That video id is not valid.')
  }
  return trimmed
}

export function sanitizeFilename(name: string) {
  const base = path.basename(name).replace(/[^\w.\-]+/g, '-')
  return base || 'video.mp4'
}

function extFromName(name: string) {
  const match = sanitizeFilename(name).toLowerCase().match(/\.(mp4|webm|mov|m4v)$/)
  return match ? match[0] : '.mp4'
}

export function ensureLocalVideoDir() {
  const dir = localVideoDir()
  mkdirSync(dir, { recursive: true })
  return dir
}

export function localMediaPath(id: string, filename?: string) {
  const safeId = sanitizeBackgroundId(id)
  const dir = ensureLocalVideoDir()
  if (filename) return path.join(dir, `${safeId}${extFromName(filename)}`)
  const found = readdirSync(dir).find((file) => file === safeId || file.startsWith(`${safeId}.`))
  return found ? path.join(dir, found) : path.join(dir, `${safeId}.mp4`)
}

export function findLocalMedia(id: string) {
  try {
    const safeId = sanitizeBackgroundId(id)
    const dir = localVideoDir()
    if (!existsSync(dir)) return null
    const found = readdirSync(dir).find((file) => file === safeId || file.startsWith(`${safeId}.`))
    return found ? path.join(dir, found) : null
  } catch {
    return null
  }
}

export async function saveLocalMedia(id: string, filename: string, req: IncomingMessage) {
  const dest = localMediaPath(id, filename)
  ensureLocalVideoDir()
  const existing = findLocalMedia(id)
  if (existing && existing !== dest && existsSync(existing)) unlinkSync(existing)
  await pipeline(req, createWriteStream(dest))
  return `/api/backgrounds/media/${encodeURIComponent(sanitizeBackgroundId(id))}`
}

export function deleteLocalMedia(id: string) {
  const existing = findLocalMedia(id)
  if (existing && existsSync(existing)) unlinkSync(existing)
}

export function localPublicSrc(id: string) {
  return `/api/backgrounds/media/${encodeURIComponent(sanitizeBackgroundId(id))}`
}

type SupabaseCfg = { url: string; key: string }

async function supabaseFetch(cfg: SupabaseCfg, pathname: string, init: RequestInit) {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${cfg.key}`)
  headers.set('apikey', cfg.key)
  return fetch(`${cfg.url}/storage/v1${pathname}`, { ...init, headers })
}

export function presentVideoBucketCreateBody() {
  return {
    id: PRESENT_VIDEO_BUCKET,
    name: PRESENT_VIDEO_BUCKET,
    public: true,
  }
}

/** Hosted plans reject ~50MB+ objects; never recreate the 1GB cap that Storage 413s. */
export function presentVideoBucketUpdateBody() {
  return {
    public: true,
    file_size_limit: 52_428_800,
  }
}

export function presentVideoSignHeaders() {
  return { 'Content-Type': 'application/json', 'x-upsert': 'true' }
}

export function storageChunkObjectPath(id: string, chunkIndex: number) {
  return `${sanitizeBackgroundId(id)}/${Math.max(0, Math.floor(chunkIndex))}`
}

export function storagePrefix(id: string) {
  return `${sanitizeBackgroundId(id)}/`
}

let presentVideoBucketReady = false

export async function ensurePresentVideoBucket(env: Env = process.env) {
  if (presentVideoBucketReady) return
  const cfg = supabaseConfig(env)
  if (!cfg) return
  const existing = await supabaseFetch(cfg, `/bucket/${PRESENT_VIDEO_BUCKET}`, { method: 'GET' })
  if (!existing.ok) {
    const created = await supabaseFetch(cfg, '/bucket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(presentVideoBucketCreateBody()),
    })
    if (!created.ok && created.status !== 409) {
      const detail = await created.text()
      if (!/already exists|duplicate|taken/i.test(detail)) {
        console.error('Could not create the present-videos storage bucket', detail)
      }
    }
  }
  const updated = await supabaseFetch(cfg, `/bucket/${PRESENT_VIDEO_BUCKET}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(presentVideoBucketUpdateBody()),
  })
  if (!updated.ok) {
    const detail = await updated.text()
    if (detail) console.error('Could not update the present-videos storage bucket', detail)
  }
  presentVideoBucketReady = true
}

function signedUploadUrl(cfg: SupabaseCfg, objectPath: string, json: { token?: string; url?: string }) {
  const token = json.token
  const uploadUrl = json.url
    ? json.url.startsWith('http')
      ? json.url
      : `${cfg.url}/storage/v1${json.url.startsWith('/') ? json.url : `/${json.url}`}`
    : `${cfg.url}/storage/v1/object/upload/sign/${PRESENT_VIDEO_BUCKET}/${objectPath}${token ? `?token=${token}` : ''}`
  return {
    uploadUrl,
    token,
    publicUrl: `${cfg.url}/storage/v1/object/public/${PRESENT_VIDEO_BUCKET}/${objectPath}`,
    objectPath,
  }
}

export async function createSupabaseUpload(
  id: string,
  filename: string,
  env: Env = process.env,
  chunkIndex?: number,
) {
  const cfg = supabaseConfig(env)
  if (!cfg) throw new Error('Supabase storage is not configured.')
  await ensurePresentVideoBucket(env)
  const objectPath =
    typeof chunkIndex === 'number' && Number.isFinite(chunkIndex)
      ? storageChunkObjectPath(id, chunkIndex)
      : `${sanitizeBackgroundId(id)}/${sanitizeFilename(filename)}`
  const signed = await supabaseFetch(cfg, `/object/upload/sign/${PRESENT_VIDEO_BUCKET}/${objectPath}`, {
    method: 'POST',
    headers: presentVideoSignHeaders(),
    body: JSON.stringify({ expiresIn: 3600, upsert: true }),
  })
  if (!signed.ok) {
    const detail = await signed.text()
    throw new Error(detail || 'Could not start the video upload.')
  }
  const json = (await signed.json()) as { token?: string; url?: string }
  return signedUploadUrl(cfg, objectPath, json)
}

export async function uploadSupabaseObject(
  objectPath: string,
  data: Buffer,
  mimeType: string,
  env: Env = process.env,
) {
  const cfg = supabaseConfig(env)
  if (!cfg) throw new Error('Supabase storage is not configured.')
  await ensurePresentVideoBucket(env)
  const uploaded = await supabaseFetch(cfg, `/object/${PRESENT_VIDEO_BUCKET}/${objectPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': mimeType || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: new Uint8Array(data),
  })
  if (!uploaded.ok) {
    const detail = await uploaded.text()
    throw new Error(detail || 'Could not store that video part.')
  }
}

export async function storageObjectSize(objectPath: string, env: Env = process.env) {
  const cfg = supabaseConfig(env)
  if (!cfg) return null
  const ranged = await supabaseFetch(cfg, `/object/authenticated/${PRESENT_VIDEO_BUCKET}/${objectPath}`, {
    method: 'GET',
    headers: { Range: 'bytes=0-0' },
  })
  if (!ranged.ok && ranged.status !== 206) return null
  const contentRange = ranged.headers.get('content-range')
  const match = contentRange ? /\/(\d+)\s*$/.exec(contentRange) : null
  if (match) return Number(match[1])
  const length = Number(ranged.headers.get('content-length') || 0)
  return Number.isFinite(length) && length > 0 ? length : null
}

export async function downloadStorageObject(objectPath: string, env: Env = process.env) {
  const cfg = supabaseConfig(env)
  if (!cfg) return null
  const res = await supabaseFetch(cfg, `/object/authenticated/${PRESENT_VIDEO_BUCKET}/${objectPath}`, {
    method: 'GET',
  })
  if (!res.ok) return null
  return Buffer.from(await res.arrayBuffer())
}

export async function listStoragePrefix(id: string, env: Env = process.env) {
  const cfg = supabaseConfig(env)
  if (!cfg) return []
  const listed = await supabaseFetch(cfg, `/object/list/${PRESENT_VIDEO_BUCKET}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: storagePrefix(id), limit: 1000 }),
  })
  if (!listed.ok) return []
  const rows = (await listed.json()) as Array<{ name?: string }>
  return rows.map((row) => row.name).filter((name): name is string => Boolean(name))
}

export async function deleteSupabasePrefix(id: string, env: Env = process.env) {
  const cfg = supabaseConfig(env)
  if (!cfg) return
  const names = await listStoragePrefix(id, env)
  const prefix = storagePrefix(id)
  const paths = names.map((name) => (name.startsWith(prefix) ? name : `${prefix}${name}`))
  if (!paths.length) return
  await supabaseFetch(cfg, `/object/${PRESENT_VIDEO_BUCKET}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: paths }),
  })
}

export async function deleteSupabaseObject(src: string, env: Env = process.env) {
  const cfg = supabaseConfig(env)
  if (!cfg) return
  const marker = `/object/public/${PRESENT_VIDEO_BUCKET}/`
  const index = src.indexOf(marker)
  if (index >= 0) {
    const objectPath = src.slice(index + marker.length).split('?')[0]
    if (objectPath) {
      await supabaseFetch(cfg, `/object/${PRESENT_VIDEO_BUCKET}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixes: [objectPath] }),
      })
    }
  }
  const match = /custom-[a-zA-Z0-9-]+/.exec(src)
  if (match) await deleteSupabasePrefix(match[0], env)
}
