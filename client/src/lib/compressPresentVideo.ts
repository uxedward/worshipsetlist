import { asVideoFile } from './customPresentBackgrounds.ts'
import {
  MAX_PRESENT_VIDEO_BYTES,
  presentVideoCompressFailedMessage,
  presentVideoEncodeFallback,
  presentVideoEncodePlan,
  type PresentVideoEncodePlan,
} from '@shared/presentVideo.ts'

function recorderMimeType() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return ''
  const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || ''
}

function extensionForMime(mimeType: string) {
  if (mimeType.includes('mp4')) return 'mp4'
  return 'webm'
}

async function loadVideo(file: File) {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.src = url
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error('Could not read that video.'))
      video.load()
    })
    return { video, url }
  } catch (err) {
    URL.revokeObjectURL(url)
    throw err
  }
}

async function encodeWithPlan(file: File, plan: Extract<PresentVideoEncodePlan, { mode: 'encode' }>) {
  const mimeType = recorderMimeType()
  if (!mimeType) throw new Error(presentVideoCompressFailedMessage())
  const { video, url } = await loadVideo(file)
  const canvas = document.createElement('canvas')
  canvas.width = plan.width
  canvas.height = plan.height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    URL.revokeObjectURL(url)
    throw new Error(presentVideoCompressFailedMessage())
  }
  const stream = canvas.captureStream(30)
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: plan.videoBitsPerSecond,
  })
  const chunks: Blob[] = []
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data)
  }

  const stop = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve()
    recorder.onerror = () => reject(new Error(presentVideoCompressFailedMessage()))
  })

  const draw = () => {
    if (video.ended || video.currentTime >= plan.durationSeconds) {
      if (recorder.state === 'recording') recorder.stop()
      video.pause()
      return
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    if ('requestVideoFrameCallback' in video) {
      video.requestVideoFrameCallback(draw)
    } else {
      requestAnimationFrame(draw)
    }
  }

  try {
    video.currentTime = 0
    await video.play()
    recorder.start(200)
    draw()
    const watchdog = window.setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop()
      video.pause()
    }, Math.ceil(plan.durationSeconds * 1000) + 4000)
    await stop
    window.clearTimeout(watchdog)
  } finally {
    video.pause()
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
    stream.getTracks().forEach((track) => track.stop())
  }

  const blob = new Blob(chunks, { type: mimeType.split(';')[0] })
  if (blob.size <= 0) throw new Error(presentVideoCompressFailedMessage())
  const base = file.name.replace(/\.[^.]+$/, '') || 'video'
  return asVideoFile(new File([blob], `${base}.${extensionForMime(mimeType)}`, { type: blob.type }))
}

export async function compressPresentVideoFile(file: File): Promise<File> {
  if (file.size > 0 && file.size <= MAX_PRESENT_VIDEO_BYTES) return file

  const { video, url } = await loadVideo(file)
  const width = video.videoWidth || 1920
  const height = video.videoHeight || 1080
  const durationSeconds = Number.isFinite(video.duration) ? video.duration : 0
  video.removeAttribute('src')
  video.load()
  URL.revokeObjectURL(url)

  let plan = presentVideoEncodePlan({
    sizeBytes: file.size,
    width,
    height,
    durationSeconds,
  })
  if (plan.mode === 'original') return file

  let encoded = await encodeWithPlan(file, plan)
  if (encoded.size <= MAX_PRESENT_VIDEO_BYTES) return encoded
  plan = presentVideoEncodeFallback(plan)
  encoded = await encodeWithPlan(file, plan)
  if (encoded.size <= MAX_PRESENT_VIDEO_BYTES) return encoded
  throw new Error(presentVideoCompressFailedMessage())
}
