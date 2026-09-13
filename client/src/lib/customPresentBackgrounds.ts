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

export function readCustomBackgroundMeta(): CustomBackgroundMeta[] {
  if (!canUseStorage()) return []
  try {
    const raw = localStorage.getItem(CUSTOM_BG_META_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CustomBackgroundMeta[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item) => item?.id && item.kind === 'video')
  } catch {
    return []
  }
}

function writeCustomBackgroundMeta(items: CustomBackgroundMeta[]) {
  if (!canUseStorage()) return
  localStorage.setItem(CUSTOM_BG_META_KEY, JSON.stringify(items))
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) {
        req.result.createObjectStore(IDB_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
  })
}

async function idbPut(id: string, blob: Blob) {
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(blob, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
  db.close()
}

async function idbGet(id: string): Promise<Blob | undefined> {
  const db = await openDb()
  if (!db) return undefined
  const blob = await new Promise<Blob | undefined>((resolve) => {
    const tx = db.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(id)
    req.onsuccess = () => resolve(req.result as Blob | undefined)
    req.onerror = () => resolve(undefined)
  })
  db.close()
  return blob
}

async function idbDel(id: string) {
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
  db.close()
}

function revokeUrl(id: string) {
  const url = objectUrls.get(id)
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
  objectUrls.delete(id)
}

export function labelFromVideoName(name: string) {
  const base = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
  if (!base) return 'Uploaded video'
  return base.replace(/\b\w/g, (ch) => ch.toUpperCase())
}

export function isAllowedVideoFile(file: File) {
  if (file.size <= 0 || file.size > MAX_CUSTOM_VIDEO_BYTES) return false
  if (file.type.startsWith('video/')) return true
  return /\.(mp4|webm|mov|m4v)$/i.test(file.name)
}

export async function posterFromVideoFile(file: File): Promise<string | undefined> {
  if (typeof document === 'undefined') return undefined
  const url = URL.createObjectURL(file)
  try {
    const poster = await new Promise<string | undefined>((resolve) => {
      const video = document.createElement('video')
      video.muted = true
      video.playsInline = true
      video.preload = 'metadata'
      const finish = (value?: string) => {
        video.src = ''
        resolve(value)
      }
      video.onerror = () => finish(undefined)
      video.onloadeddata = () => {
        try {
          video.currentTime = Math.min(0.4, Number.isFinite(video.duration) ? video.duration * 0.05 : 0.4)
        } catch {
          finish(undefined)
        }
      }
      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = 320
          canvas.height = 180
          const ctx = canvas.getContext('2d')
          if (!ctx) return finish(undefined)
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          finish(canvas.toDataURL('image/jpeg', 0.72))
        } catch {
          finish(undefined)
        }
      }
      video.src = url
    })
    return poster
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function hydrateCustomBackground(meta: CustomBackgroundMeta): Promise<PresentBackground> {
  if (meta.src && !meta.src.startsWith('blob:')) {
    return { ...meta, group: 'motion', kind: 'video' }
  }
  const existing = objectUrls.get(meta.id)
  if (existing) return { ...meta, src: existing, group: 'motion', kind: 'video' }
  const blob = await idbGet(meta.id)
  if (!blob) return { ...meta, group: 'motion', kind: 'video' }
  const url = URL.createObjectURL(blob)
  objectUrls.set(meta.id, url)
  return { ...meta, src: url, group: 'motion', kind: 'video' }
}

export async function loadCustomBackgrounds(): Promise<PresentBackground[]> {
  const metas = readCustomBackgroundMeta()
  const out: PresentBackground[] = []
  for (const meta of metas) out.push(await hydrateCustomBackground(meta))
  return out
}

export function mergeCustomBackgrounds(
  local: PresentBackground[],
  remote: PresentBackground[],
): PresentBackground[] {
  const byId = new Map<string, PresentBackground>()
  for (const bg of local) byId.set(bg.id, bg)
  for (const bg of remote) {
    const current = byId.get(bg.id)
    if (!current || (bg.src && !bg.src.startsWith('blob:'))) byId.set(bg.id, { ...current, ...bg, custom: true, group: 'motion', kind: 'video' })
  }
  return Array.from(byId.values())
}

export async function addCustomBackgroundFile(file: File): Promise<PresentBackground> {
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
  return { ...meta, src }
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

export async function deleteCustomBackground(id: string) {
  revokeUrl(id)
  await idbDel(id)
  writeCustomBackgroundMeta(readCustomBackgroundMeta().filter((item) => item.id !== id))
}

export async function promoteCustomBackgroundSrc(id: string, src: string) {
  revokeUrl(id)
  await idbDel(id)
  writeCustomBackgroundMeta(
    readCustomBackgroundMeta().map((item) => (item.id === id ? { ...item, src } : item)),
  )
}
