import { endpoints } from './api.ts'
import {
  CUSTOM_BG_PREFIX,
  isAllowedVideoFile,
  labelFromVideoName,
  posterFromVideoFile,
  rememberRemoteBackground,
} from './customPresentBackgrounds.ts'
import type { PresentBackground } from './presentBackgrounds.ts'

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

export async function uploadPresentVideoFile(file: File): Promise<PresentBackground> {
  if (!isAllowedVideoFile(file)) {
    throw new Error('Choose an MP4, WebM, or MOV video under 1 GB.')
  }
  const caps = await endpoints.backgrounds()
  const provider = caps.provider ?? (caps.blobEnabled ? 'blob' : caps.supabaseEnabled ? 'supabase' : 'none')
  const hostingEnabled = caps.hostingEnabled ?? provider !== 'none'
  if (!hostingEnabled) {
    throw new Error('Video hosting is not enabled, so uploads cannot appear in other browsers.')
  }
  const id = `${CUSTOM_BG_PREFIX}${crypto.randomUUID()}`
  const label = labelFromVideoName(file.name)
  const poster = await posterFromVideoFile(file)
  const contentType = file.type || 'video/mp4'
  let src: string

  if (provider === 'blob' || caps.blobEnabled) {
    const { upload } = await import('@vercel/blob/client')
    const blob = await upload(`present-videos/${id}/${file.name}`, file, {
      access: 'public',
      handleUploadUrl: '/api/backgrounds/upload',
      contentType,
      multipart: true,
    })
    src = blob.url
  } else if (provider === 'supabase' || caps.supabaseEnabled) {
    const session = await endpoints.createBackgroundUpload({
      id,
      filename: file.name,
      contentType,
    })
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'x-upsert': 'true',
    }
    if (session.token) headers.authorization = `Bearer ${session.token}`
    const put = await fetch(session.uploadUrl, { method: 'PUT', headers, body: file })
    if (!put.ok) throw new Error('Could not upload that 4K video.')
    src = session.publicUrl
  } else if (provider === 'local') {
    const put = await fetch(
      `/api/backgrounds/media/${encodeURIComponent(id)}?name=${encodeURIComponent(file.name)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: file,
      },
    )
    if (!put.ok) {
      let message = 'Could not upload that video.'
      try {
        const data = (await put.json()) as { error?: string }
        if (data.error) message = data.error
      } catch {
        /* keep default */
      }
      throw new Error(message)
    }
    const saved = (await put.json()) as { src?: string }
    src = saved.src || `/api/backgrounds/media/${encodeURIComponent(id)}`
  } else {
    throw new Error('Video hosting is not enabled, so uploads cannot appear in other browsers.')
  }

  const saved = await endpoints.createBackground({ id, label, src, poster })
  const hosted = asSharedVideo(saved, saved.src ?? src)
  await rememberRemoteBackground(hosted)
  return hosted
}
