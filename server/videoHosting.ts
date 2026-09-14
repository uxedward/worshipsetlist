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

export async function ensurePresentVideoBucket(env: Env = process.env) {
  const cfg = supabaseConfig(env)
  if (!cfg) return
  const existing = await supabaseFetch(cfg, `/bucket/${PRESENT_VIDEO_BUCKET}`, { method: 'GET' })
  if (existing.ok) return
  const created = await supabaseFetch(cfg, '/bucket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: PRESENT_VIDEO_BUCKET,
      name: PRESENT_VIDEO_BUCKET,
      public: true,
      file_size_limit: MAX_PRESENT_VIDEO_BYTES,
    }),
  })
  if (!created.ok && created.status !== 409) {
    const detail = await created.text()
    throw new Error(detail || 'Could not create the present-videos storage bucket.')
  }
}

export async function createSupabaseUpload(
  id: string,
  filename: string,
  env: Env = process.env,
) {
  const cfg = supabaseConfig(env)
  if (!cfg) throw new Error('Supabase storage is not configured.')
  await ensurePresentVideoBucket(env)
  const objectPath = `${sanitizeBackgroundId(id)}/${sanitizeFilename(filename)}`
  const signed = await supabaseFetch(cfg, `/object/upload/sign/${PRESENT_VIDEO_BUCKET}/${objectPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 3600 }),
  })
  if (!signed.ok) {
    const detail = await signed.text()
    throw new Error(detail || 'Could not start the video upload.')
  }
  const json = (await signed.json()) as { token?: string; url?: string }
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
  }
}

export async function deleteSupabaseObject(src: string, env: Env = process.env) {
  const cfg = supabaseConfig(env)
  if (!cfg) return
  const marker = `/object/public/${PRESENT_VIDEO_BUCKET}/`
  const index = src.indexOf(marker)
  if (index < 0) return
  const objectPath = src.slice(index + marker.length).split('?')[0]
  if (!objectPath) return
  await supabaseFetch(cfg, `/object/${PRESENT_VIDEO_BUCKET}/${objectPath}`, { method: 'DELETE' })
}
