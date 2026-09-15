import type { PresentBackground } from './presentBackgrounds.ts'

export const CUSTOM_BG_META_KEY = 'setflow.presentBackgrounds.custom.v1'
const IDB_NAME = 'setflow-present-backgrounds'
const IDB_STORE = 'files'
export const CUSTOM_BG_PREFIX = 'custom-'
export const MAX_CUSTOM_VIDEO_BYTES = 1024 * 1024 * 1024

export type CustomBackgroundMeta = {
  id: string
  label: string
  kind: 'video'
  group: 'motion'
  poster?: string
  src?: string
  custom: true
}

const objectUrls = new Map<string, string>()

function canUseStorage() {
  return typeof localStorage !== 'undefined'
}

export function isCustomBackgroundId(id: string) {
  return id.startsWith(CUSTOM_BG_PREFIX)
}

export function isHostedBackgroundSrc(src?: string) {
  return Boolean(
    src && (/^https?:\/\//i.test(src) || src.startsWith('/api/backgrounds/media/')),
  )
}

export function readCustomBackgroundMeta(): CustomBackgroundMeta[] {
  if (!canUseStorage()) return []
  try {
    const raw = localStorage.getItem(CUSTOM_BG_META_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CustomBackgroundMeta[]
    return Array.isArray(parsed) ? parsed.filter((item) => item?.custom && item.id) : []
  } catch {
    return []
  }
}

function writeCustomBackgroundMeta(items: CustomBackgroundMeta[]) {
  if (!canUseStorage()) return
  try {
    localStorage.setItem(CUSTOM_BG_META_KEY, JSON.stringify(items))
  } catch {
    /* optional cache */
  }
}

function canUseIdb() {
  return typeof indexedDB !== 'undefined'
}

function openDb(): Promise<IDBDatabase> {
  if (!canUseIdb()) return Promise.reject(new Error('IndexedDB is unavailable.'))
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbPut(id: string, file: File) {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(file, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

async function idbGet(id: string): Promise<File | undefined> {
  const db = await openDb()
  const file = await new Promise<File | undefined>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(id)
    req.onsuccess = () => resolve(req.result as File | undefined)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return file
}

async function idbDel(id: string) {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch {
    /* local cache is optional once the video is hosted */
  }
}

function revokeUrl(id: string) {
  const existing = objectUrls.get(id)
  if (existing) {
    URL.revokeObjectURL(existing)
    objectUrls.delete(id)
  }
}

export function asVideoFile(input: Blob, fallbackName = 'video.mp4'): File {
  const named = input instanceof File ? input.name.trim() : ''
  const name = named || fallbackName
  const type = input.type || (/\.webm$/i.test(name) ? 'video/webm' : 'video/mp4')
  if (input instanceof File && named) return input
  return new File([input], name, { type, lastModified: Date.now() })
}

export function isAllowedVideoFile(file: File) {
  if (file.size <= 0 || file.size > MAX_CUSTOM_VIDEO_BYTES) return false
  const type = file.type.toLowerCase()
  if (type.startsWith('video/')) return true
  return /\.(mp4|webm|mov|m4v)$/i.test(file.name)
}

export function labelFromVideoName(name: string) {
  const base = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
  if (!base) return 'Uploaded video'
  return base.replace(/\b\w/g, (ch) => ch.toUpperCase())
}

export async function posterFromVideoFile(file: File): Promise<string | undefined> {
  const url = URL.createObjectURL(file)
  try {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.src = url
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve()
      video.onerror = () => reject(new Error('Could not read that video.'))
      video.load()
    })
    video.currentTime = Math.min(0.4, Number.isFinite(video.duration) ? video.duration / 4 : 0.4)
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve()
      setTimeout(resolve, 800)
    })
    const canvas = document.createElement('canvas')
    const w = video.videoWidth || 1280
    const h = video.videoHeight || 720
    const scale = Math.min(1, 640 / Math.max(w, h))
    canvas.width = Math.max(1, Math.round(w * scale))
    canvas.height = Math.max(1, Math.round(h * scale))
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.72)
  } catch {
    return undefined
  } finally {
    URL.revokeObjectURL(url)
  }
}

function asHostedVideo(bg: PresentBackground | CustomBackgroundMeta): PresentBackground {
  const src = bg.src
  return {
    id: bg.id,
    label: bg.label,
    kind: 'video',
    group: 'motion',
    poster: bg.poster,
    src,
    src4k: ('src4k' in bg && bg.src4k) || src,
    custom: true,
    sizeBytes: 'sizeBytes' in bg ? bg.sizeBytes : undefined,
    mimeType: 'mimeType' in bg ? bg.mimeType : undefined,
    chunkBaseUrl: 'chunkBaseUrl' in bg ? bg.chunkBaseUrl : undefined,
    chunkUrls: 'chunkUrls' in bg ? bg.chunkUrls : undefined,
  }
}

/** Remote metadata is shared; a local blob URL stays so this browser can keep playing 4K. */
export function mergeCustomBackgrounds(
  local: Array<PresentBackground | CustomBackgroundMeta>,
  remote: PresentBackground[],
): PresentBackground[] {
  const byId = new Map<string, PresentBackground>()
  for (const bg of local) byId.set(bg.id, asHostedVideo(bg))
  for (const bg of remote) {
    const hosted = asHostedVideo(bg)
    const existing = byId.get(hosted.id)
    if (existing?.src?.startsWith('blob:')) {
      byId.set(hosted.id, {
        ...hosted,
        src: existing.src,
        src4k: existing.src,
        poster: hosted.poster ?? existing.poster,
      })
      continue
    }
    if (!existing || isHostedBackgroundSrc(hosted.src)) {
      byId.set(hosted.id, hosted)
    }
  }
  return [...byId.values()]
}

export async function hydrateCustomBackgrounds(): Promise<PresentBackground[]> {
  const metas = readCustomBackgroundMeta()
  const hydrated: PresentBackground[] = []
  for (const meta of metas) {
    try {
      const file = await idbGet(meta.id)
      if (file) {
        revokeUrl(meta.id)
        const src = URL.createObjectURL(file)
        objectUrls.set(meta.id, src)
        hydrated.push({
          id: meta.id,
          label: meta.label,
          kind: 'video',
          group: 'motion',
          poster: meta.poster,
          src,
          src4k: src,
          custom: true,
          sizeBytes: file.size,
        })
        continue
      }
    } catch {
      /* fall through to the hosted URL */
    }
    if (isHostedBackgroundSrc(meta.src)) {
      hydrated.push({
        id: meta.id,
        label: meta.label,
        kind: 'video',
        group: 'motion',
        poster: meta.poster,
        src: meta.src,
        src4k: meta.src,
        custom: true,
      })
    }
  }
  return hydrated
}

export async function listLocalCustomVideos(): Promise<
  Array<{ id: string; meta: CustomBackgroundMeta; file?: File }>
> {
  const metas = readCustomBackgroundMeta()
  const out: Array<{ id: string; meta: CustomBackgroundMeta; file?: File }> = []
  for (const meta of metas) {
    try {
      const file = await idbGet(meta.id)
      out.push({ id: meta.id, meta, file })
    } catch {
      out.push({ id: meta.id, meta })
    }
  }
  return out
}

export async function saveCustomVideoFile(file: File): Promise<PresentBackground> {
  if (!isAllowedVideoFile(file)) {
    throw new Error('Choose an MP4, WebM, or MOV video under 1 GB.')
  }
  const id = `${CUSTOM_BG_PREFIX}${crypto.randomUUID()}`
  const poster = await posterFromVideoFile(file)
  await idbPut(id, file)
  const src = URL.createObjectURL(file)
  objectUrls.set(id, src)
  const meta: CustomBackgroundMeta = {
    id,
    label: labelFromVideoName(file.name),
    kind: 'video',
    group: 'motion',
    poster,
    custom: true,
  }
  writeCustomBackgroundMeta([...readCustomBackgroundMeta().filter((item) => item.id !== id), meta])
  return { ...meta, src, src4k: src }
}

export async function rememberRemoteBackground(bg: PresentBackground) {
  const meta: CustomBackgroundMeta = {
    id: bg.id.startsWith(CUSTOM_BG_PREFIX) ? bg.id : `${CUSTOM_BG_PREFIX}${bg.id}`,
    label: bg.label,
    kind: 'video',
    group: 'motion',
    poster: bg.poster,
    src: bg.src,
    custom: true,
  }
  writeCustomBackgroundMeta([...readCustomBackgroundMeta().filter((item) => item.id !== meta.id), meta])
}

export async function readLocalVideoFile(id: string) {
  try {
    return await idbGet(id)
  } catch {
    return undefined
  }
}

export async function cacheLocalVideoFile(id: string, file: File) {
  await idbPut(id, file)
}

export async function forgetLocalVideoBytes(id: string) {
  revokeUrl(id)
  await idbDel(id).catch(() => {
    /* hosted copy is already saved */
  })
}

export async function deleteCustomBackground(id: string) {
  revokeUrl(id)
  await idbDel(id)
  writeCustomBackgroundMeta(readCustomBackgroundMeta().filter((item) => item.id !== id))
}
