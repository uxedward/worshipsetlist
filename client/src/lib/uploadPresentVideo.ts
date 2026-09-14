import { endpoints } from './api.ts'
import {
  CUSTOM_BG_PREFIX,
  isAllowedVideoFile,
  isHostedBackgroundSrc,
  labelFromVideoName,
  listLocalCustomVideos,
  posterFromVideoFile,
  rememberRemoteBackground,
} from './customPresentBackgrounds.ts'
import type { PresentBackground } from './presentBackgrounds.ts'
import { PRESENT_VIDEO_CHUNK_BYTES, presentVideoChunkCount, presentVideoSrc } from '@shared/presentVideo.ts'

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

async function saveBackgroundRecord(body: { id: string; label: string; src: string; poster?: string }) {
  try {
    return await endpoints.createBackground(body)
  } catch (err) {
    if (!body.poster) throw err
    return await endpoints.createBackground({ id: body.id, label: body.label, src: body.src })
  }
}

export async function uploadPresentVideoFile(
  file: File,
  existingId?: string,
  extras?: { poster?: string },
): Promise<PresentBackground> {
  if (!isAllowedVideoFile(file)) {
    throw new Error('Choose an MP4, WebM, or MOV video under 1 GB.')
  }
  const id = existingId?.startsWith(CUSTOM_BG_PREFIX) ? existingId : `${CUSTOM_BG_PREFIX}${crypto.randomUUID()}`
  const label = labelFromVideoName(file.name)
  const poster = extras?.poster ?? (await posterFromVideoFile(file))
  const chunkCount = presentVideoChunkCount(file.size)
  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
    await putVideoChunk(id, file, chunkIndex, chunkCount)
  }
  const src = presentVideoSrc(id)
  const saved = await saveBackgroundRecord({ id, label, src, poster })
  const hosted = asSharedVideo(saved, saved.src ?? src)
  await rememberRemoteBackground(hosted).catch(() => {
    /* shared database row already succeeded */
  })
  return hosted
}

export async function publishLocalPresentVideos(remote: PresentBackground[]): Promise<{
  published: PresentBackground[]
  errors: string[]
}> {
  const remoteById = new Map(remote.map((bg) => [bg.id, bg]))
  const local = await listLocalCustomVideos()
  const published: PresentBackground[] = []
  const errors: string[] = []
  for (const item of local) {
    try {
      const already = remoteById.get(item.id)
      if (already && isHostedBackgroundSrc(already.src)) continue
      if (item.file) {
        published.push(await uploadPresentVideoFile(item.file, item.id, { poster: item.meta.poster }))
        continue
      }
      if (item.meta.src && isHostedBackgroundSrc(item.meta.src) && !already) {
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
