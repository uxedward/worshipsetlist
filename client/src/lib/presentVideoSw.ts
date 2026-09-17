import {
  PRESENT_VIDEO_STORAGE_CHUNK_BYTES,
  presentStreamSrc,
} from '@shared/presentVideo.ts'
import type { PresentBackground } from './presentBackgrounds.ts'

export type PresentVideoManifest = {
  id: string
  sizeBytes: number
  mimeType?: string
  chunkBaseUrl: string
  chunkBytes: number
}

let registering: Promise<boolean> | null = null

export function canUsePresentVideoSw() {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator
}

export async function installPresentVideoSw() {
  if (!canUsePresentVideoSw()) return false
  if (!registering) {
    registering = navigator.serviceWorker
      .register('/present-video-sw.js', { scope: '/' })
      .then(async () => {
        await navigator.serviceWorker.ready
        if (navigator.serviceWorker.controller) return true
        await new Promise<void>((resolve) => {
          const onChange = () => {
            navigator.serviceWorker.removeEventListener('controllerchange', onChange)
            resolve()
          }
          navigator.serviceWorker.addEventListener('controllerchange', onChange)
          window.setTimeout(resolve, 4000)
        })
        if (navigator.serviceWorker.controller) return true
        for (let i = 0; i < 10; i++) {
          if (navigator.serviceWorker.controller) return true
          await new Promise((resolve) => window.setTimeout(resolve, 100))
        }
        return Boolean(navigator.serviceWorker.controller)
      })
      .catch(() => false)
  }
  return registering
}

export async function bindPresentVideoManifest(manifest: PresentVideoManifest) {
  const ready = await installPresentVideoSw()
  const worker = navigator.serviceWorker?.controller
  if (!ready || !worker) return false
  return new Promise<boolean>((resolve) => {
    const channel = new MessageChannel()
    const timer = window.setTimeout(() => resolve(false), 1200)
    channel.port1.onmessage = () => {
      window.clearTimeout(timer)
      resolve(true)
    }
    worker.postMessage({ type: 'present-video-manifest', manifest }, [channel.port2])
  })
}

export async function presentStreamUrl(background: PresentBackground): Promise<string | undefined> {
  if (!background.custom || !background.chunkBaseUrl || !background.sizeBytes) return undefined
  const ok = await bindPresentVideoManifest({
    id: background.id,
    sizeBytes: background.sizeBytes,
    mimeType: background.mimeType,
    chunkBaseUrl: background.chunkBaseUrl,
    chunkBytes: PRESENT_VIDEO_STORAGE_CHUNK_BYTES,
  })
  if (!ok) return undefined
  const base = background.chunkBaseUrl.replace(/\/?$/, '/')
  for (let index = 0; index < 4; index++) {
    void fetch(`${base}${index}`, { mode: 'cors' }).catch(() => undefined)
  }
  return presentStreamSrc(background.id)
}
