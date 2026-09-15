import {
  PRESENT_VIDEO_RANGE_MAX_BYTES,
  presentVideoChunkUrls,
} from '@shared/presentVideo.ts'
import { cacheLocalVideoFile, readLocalVideoFile } from './customPresentBackgrounds.ts'
import { pickPresentVideoSrc, type PresentBackground } from './presentBackgrounds.ts'

const playableUrls = new Map<string, string>()
const inflight = new Map<string, Promise<string | undefined>>()

function rememberUrl(id: string, file: Blob) {
  const previous = playableUrls.get(id)
  if (previous) URL.revokeObjectURL(previous)
  const url = URL.createObjectURL(file)
  playableUrls.set(id, url)
  return url
}

async function runPool(count: number, limit: number, worker: (index: number) => Promise<void>) {
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, count) }, async () => {
      while (next < count) {
        const index = next++
        await worker(index)
      }
    }),
  )
}

export function chunkUrlsForBackground(background: PresentBackground): string[] {
  if (background.chunkUrls?.length) return background.chunkUrls
  if (background.chunkBaseUrl && background.sizeBytes && background.sizeBytes > 0) {
    return presentVideoChunkUrls(background.chunkBaseUrl, background.sizeBytes)
  }
  return []
}

async function downloadChunks(urls: string[], mimeType?: string, name = 'video.mp4') {
  const parts: Blob[] = new Array(urls.length)
  await runPool(urls.length, 6, async (index) => {
    const url = urls[index]!
    let lastError = 'Could not download that video.'
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(url)
      if (res.ok) {
        parts[index] = await res.blob()
        return
      }
      lastError = `Could not download that video (${res.status}).`
      await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt))
    }
    throw new Error(lastError)
  })
  if (parts.some((part) => !part || part.size <= 0)) {
    throw new Error('Could not download that video.')
  }
  return new File(parts, name, { type: mimeType || 'video/mp4', lastModified: Date.now() })
}

export async function downloadViaRange(src: string, sizeBytes: number, mimeType?: string) {
  const parts: Blob[] = []
  const step = PRESENT_VIDEO_RANGE_MAX_BYTES
  for (let start = 0; start < sizeBytes; start += step) {
    const end = Math.min(start + step - 1, sizeBytes - 1)
    const res = await fetch(src, { headers: { Range: `bytes=${start}-${end}` } })
    if (!res.ok && res.status !== 206) throw new Error('Could not load that video.')
    parts.push(await res.blob())
  }
  return new File(parts, 'video.mp4', { type: mimeType || 'video/mp4', lastModified: Date.now() })
}

export async function resolvePlayablePresentSrc(
  background: PresentBackground,
): Promise<string | undefined> {
  if (background.kind !== 'video') return undefined
  if (!background.custom) return pickPresentVideoSrc(background)
  if (background.src?.startsWith('blob:')) return background.src

  const cached = playableUrls.get(background.id)
  if (cached) return cached
  const pending = inflight.get(background.id)
  if (pending) return pending

  const work = (async () => {
    const local = await readLocalVideoFile(background.id)
    if (local && local.size > 0) return rememberUrl(background.id, local)

    const urls = chunkUrlsForBackground(background)
    if (urls.length) {
      const file = await downloadChunks(urls, background.mimeType, `${background.id}.mp4`)
      await cacheLocalVideoFile(background.id, file).catch(() => undefined)
      return rememberUrl(background.id, file)
    }

    if (background.src && background.sizeBytes && background.sizeBytes > 0) {
      const file = await downloadViaRange(background.src, background.sizeBytes, background.mimeType)
      await cacheLocalVideoFile(background.id, file).catch(() => undefined)
      return rememberUrl(background.id, file)
    }

    return pickPresentVideoSrc(background)
  })()

  inflight.set(background.id, work)
  try {
    return await work
  } finally {
    if (inflight.get(background.id) === work) inflight.delete(background.id)
  }
}
