import { endpoints } from './api.ts'
import {
  CUSTOM_BG_PREFIX,
  asVideoFile,
  isAllowedVideoFile,
  isHostedBackgroundSrc,
  labelFromVideoName,
  listLocalCustomVideos,
  posterFromVideoFile,
  rememberRemoteBackground,
} from './customPresentBackgrounds.ts'
import type { PresentBackground } from './presentBackgrounds.ts'
import {
  PRESENT_VIDEO_CHUNK_BYTES,
  PRESENT_VIDEO_STORAGE_CHUNK_BYTES,
  presentVideoChunkCount,
  presentVideoSrc,
  presentVideoStorageChunkCount,
} from '@shared/presentVideo.ts'

function asSharedVideo(bg: PresentBackground, src: string): PresentBackground {
  return {
    ...bg,
    kind: 'video',
    group: 'motion',
    custom: true,
    src,
    src4k: src,
  }
}

function trimPoster(poster?: string) {
  if (!poster || poster.length > 180_000) return undefined
  return poster
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

async function putVideoChunk(id: string, file: File, chunkIndex: number, chunkCount: number) {
  const blob = file.slice(
    chunkIndex * PRESENT_VIDEO_CHUNK_BYTES,
    (chunkIndex + 1) * PRESENT_VIDEO_CHUNK_BYTES,
  )
  let lastError = 'Could not store that video in the database.'
  for (let attempt = 0; attempt < 3; attempt++) {
    const put = await fetch(
      `/api/backgrounds/media/${encodeURIComponent(id)}?chunk=${chunkIndex}&chunks=${chunkCount}&name=${encodeURIComponent(file.name)}&type=${encodeURIComponent(file.type || 'video/mp4')}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: blob,
      },
    )
    if (put.ok) return
    try {
      const data = (await put.json()) as { error?: string }
      if (data.error) lastError = data.error
    } catch {
      lastError = put.status === 504 ? 'The database timed out while saving that video.' : lastError
    }
    if (put.status < 500 && put.status !== 429) break
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt))
  }
  throw new Error(lastError)
}

async function saveBackgroundRecord(body: {
  id: string
  label: string
  src: string
  poster?: string
  sizeBytes?: number
  mimeType?: string
}) {
  const poster = trimPoster(body.poster)
  const payload = {
    id: body.id,
    label: body.label,
    src: body.src,
    sizeBytes: body.sizeBytes,
    mimeType: body.mimeType,
  }
  try {
    return await endpoints.createBackground({ ...payload, poster })
  } catch (err) {
    if (!poster) throw err
    return await endpoints.createBackground(payload)
  }
}

export async function saveBackgroundStub(body: { id: string; label: string; poster?: string }) {
  return saveBackgroundRecord({
    id: body.id,
    label: body.label,
    src: presentVideoSrc(body.id),
    poster: body.poster,
  })
}

async function putSignedStorageChunk(id: string, file: File, chunkIndex: number, chunkBytes: number) {
  const blob = file.slice(chunkIndex * chunkBytes, (chunkIndex + 1) * chunkBytes)
  let lastError = 'Could not upload that video to storage.'
  for (let attempt = 0; attempt < 3; attempt++) {
    const session = await endpoints.createBackgroundUpload({
      id,
      filename: file.name,
      contentType: file.type || 'video/mp4',
      chunkIndex,
    })
    const headers: Record<string, string> = {
      'Content-Type': file.type || 'video/mp4',
      'x-upsert': 'true',
    }
    if (session.token) headers.authorization = `Bearer ${session.token}`
    const put = await fetch(session.uploadUrl, { method: 'PUT', headers, body: blob })
    if (put.ok) return
    let detail = `Storage upload failed (${put.status}).`
    try {
      const data = (await put.json()) as { error?: string; message?: string }
      if (data.message || data.error) detail = data.message || data.error || detail
    } catch {
      /* keep status text */
    }
    lastError = detail
    if (put.status === 413) break
    await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt))
  }
  throw new Error(lastError)
}

async function uploadToSupabase(id: string, file: File): Promise<string> {
  const chunkCount = presentVideoStorageChunkCount(file.size)
  await runPool(chunkCount, 4, (chunkIndex) =>
    putSignedStorageChunk(id, file, chunkIndex, PRESENT_VIDEO_STORAGE_CHUNK_BYTES),
  )
  return presentVideoSrc(id)
}

async function uploadToDatabase(id: string, file: File): Promise<string> {
  const chunkCount = presentVideoChunkCount(file.size)
  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
    await putVideoChunk(id, file, chunkIndex, chunkCount)
  }
  return presentVideoSrc(id)
}

export async function uploadPresentVideoFile(
  file: File,
  existingId?: string,
  extras?: { poster?: string },
): Promise<PresentBackground> {
  const upload = asVideoFile(file, existingId ? `${existingId}.mp4` : 'video.mp4')
  if (!isAllowedVideoFile(upload)) {
    throw new Error('Choose an MP4, WebM, or MOV video under 1 GB.')
  }
  const id = existingId?.startsWith(CUSTOM_BG_PREFIX) ? existingId : `${CUSTOM_BG_PREFIX}${crypto.randomUUID()}`
  const label = labelFromVideoName(upload.name)
  const poster = extras?.poster ?? (await posterFromVideoFile(upload))
  const caps = await endpoints.backgrounds()
  const src = caps.supabaseEnabled ? await uploadToSupabase(id, upload) : await uploadToDatabase(id, upload)
  const saved = await saveBackgroundRecord({
    id,
    label,
    src,
    poster,
    sizeBytes: upload.size,
    mimeType: upload.type || 'video/mp4',
  })
  const hosted = asSharedVideo(saved, saved.src ?? src)
  await rememberRemoteBackground(hosted).catch(() => {
    /* shared database row already succeeded */
  })
  return hosted
}

export async function publishLocalPresentVideos(
  remote: PresentBackground[],
  options?: { onProgress?: (current: number, total: number, label: string) => void },
): Promise<{
  published: PresentBackground[]
  errors: string[]
}> {
  const remoteById = new Map(remote.map((bg) => [bg.id, bg]))
  const local = await listLocalCustomVideos()
  const queued = local.filter((item) => {
    const already = remoteById.get(item.id)
    if (already && isHostedBackgroundSrc(already.src)) return false
    return Boolean(item.file) || Boolean(item.meta.src && isHostedBackgroundSrc(item.meta.src))
  })
  const published: PresentBackground[] = []
  const errors: string[] = []
  for (let index = 0; index < queued.length; index++) {
    const item = queued[index]!
    options?.onProgress?.(index + 1, queued.length, item.meta.label)
    try {
      if (item.file) {
        const file = asVideoFile(item.file, `${item.meta.label || item.id}.mp4`)
        published.push(await uploadPresentVideoFile(file, item.id, { poster: item.meta.poster }))
        continue
      }
      if (item.meta.src && isHostedBackgroundSrc(item.meta.src)) {
        const saved = await saveBackgroundRecord({
          id: item.id,
          label: item.meta.label,
          src: item.meta.src,
          poster: item.meta.poster,
        })
        published.push(asSharedVideo(saved, saved.src ?? item.meta.src))
      }
    } catch (err) {
      errors.push(`${item.meta.label}: ${err instanceof Error ? err.message : 'Could not save that video.'}`)
    }
  }
  return { published, errors }
}
