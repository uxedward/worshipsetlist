import { endpoints } from './api.ts'
import {
  asVideoFile,
  forgetLocalVideoBytes,
  isHostedBackgroundSrc,
  listLocalCustomVideos,
} from './customPresentBackgrounds.ts'
import type { PresentBackground } from './presentBackgrounds.ts'
import { publishLocalPresentVideos, saveBackgroundStub } from './uploadPresentVideo.ts'

export type PresentVideoPending = {
  id: string
  label: string
  sizeBytes: number
  poster?: string
}

export type PresentVideoSyncStatus = {
  copying: boolean
  current: number
  total: number
  label: string | null
  error: string | null
  backgrounds: PresentBackground[]
  pending: PresentVideoPending[]
}

type Listener = (status: PresentVideoSyncStatus) => void

const listeners = new Set<Listener>()

let status: PresentVideoSyncStatus = {
  copying: false,
  current: 0,
  total: 0,
  label: null,
  error: null,
  backgrounds: [],
  pending: [],
}

let running: Promise<void> | null = null

function setStatus(patch: Partial<PresentVideoSyncStatus>) {
  status = { ...status, ...patch }
  listeners.forEach((listener) => listener(status))
}

export function getPresentVideoSyncStatus() {
  return status
}

export function subscribePresentVideoSync(listener: Listener) {
  listeners.add(listener)
  listener(status)
  return () => {
    listeners.delete(listener)
  }
}

export function pendingAsBackgrounds(pending: PresentVideoPending[]): PresentBackground[] {
  return pending.map((row) => ({
    id: row.id,
    label: row.label,
    kind: 'video',
    group: 'motion',
    poster: row.poster,
    custom: true,
    pending: true,
  }))
}

async function registerLocalStubs() {
  const local = await listLocalCustomVideos()
  for (const item of local) {
    if (!item.file && !(item.meta.src && isHostedBackgroundSrc(item.meta.src))) continue
    try {
      await saveBackgroundStub({
        id: item.id,
        label: item.meta.label,
        poster: item.meta.poster,
      })
    } catch {
      /* listing can still copy the file next */
    }
  }
}

async function dropSharedLocalBytes(remote: PresentBackground[]) {
  const local = await listLocalCustomVideos()
  for (const item of local) {
    const shared = remote.find((bg) => bg.id === item.id)
    if (shared && isHostedBackgroundSrc(shared.src) && item.file) {
      await forgetLocalVideoBytes(item.id)
    }
  }
}

async function runPresentVideoSync() {
  setStatus({ copying: true, error: null })
  await registerLocalStubs()
  let lastErrors: string[] = []
  for (let attempt = 0; attempt < 12; attempt++) {
    const remote = await endpoints.backgrounds()
    setStatus({
      backgrounds: remote.backgrounds ?? [],
      pending: remote.pending ?? [],
    })
    const result = await publishLocalPresentVideos(remote.backgrounds ?? [], {
      onProgress(current, total, label) {
        setStatus({ copying: true, current, total, label, error: null })
      },
    })
    const latest = await endpoints.backgrounds()
    lastErrors = result.errors
    setStatus({
      backgrounds: latest.backgrounds ?? [],
      pending: latest.pending ?? [],
      error: result.errors.length ? result.errors.join(' ') : null,
    })
    await dropSharedLocalBytes(latest.backgrounds ?? [])
    const local = await listLocalCustomVideos()
    const stillLocal = local.some((item) => {
      if (latest.backgrounds?.some((bg) => bg.id === item.id && isHostedBackgroundSrc(bg.src))) return false
      return Boolean(item.file) || Boolean(item.meta.src && isHostedBackgroundSrc(item.meta.src))
    })
    if (!result.errors.length && !stillLocal) {
      setStatus({ copying: false, current: 0, total: 0, label: null, error: null })
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 8000))
  }
  setStatus({
    copying: false,
    current: 0,
    total: 0,
    label: null,
    error: lastErrors.length ? lastErrors.join(' ') : 'Could not copy uploaded videos to the shared library.',
  })
}

/** Survives Present mode closing. Never cancel an in-flight 4K copy. */
export function startPresentVideoSync() {
  if (!running) {
    running = runPresentVideoSync().finally(() => {
      running = null
    })
  }
  return running
}
