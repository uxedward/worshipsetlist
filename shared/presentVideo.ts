/** Small enough to fit a Vercel function body when storage is unavailable. */
export const PRESENT_VIDEO_CHUNK_BYTES = 2 * 1024 * 1024
/** Hosted Storage rejects objects around 50MB; keep each part well under that cap. */
export const PRESENT_VIDEO_STORAGE_CHUNK_BYTES = 8 * 1024 * 1024
export const PRESENT_VIDEO_RANGE_MAX_BYTES = 3 * 1024 * 1024
/** First open-ended Range from the video element; one Storage part, enough to start 4K. */
export const PRESENT_VIDEO_STREAM_SLICE_BYTES = PRESENT_VIDEO_STORAGE_CHUNK_BYTES
/**
 * Stored-file cap for custom Present clips. The free Storage plan is ~1GB;
 * a 1GB upload filled it. Keep this under the ~50MB per-object bucket limit
 * and never restore that 1GB bucket cap — it 413s on hosted plans.
 */
export const MAX_PRESENT_VIDEO_BYTES = 40 * 1024 * 1024
export const MAX_PRESENT_VIDEO_MB = 40
/** Source files can still be 4K; they are compressed before they hit Storage. */
export const MAX_PRESENT_VIDEO_SOURCE_BYTES = 1024 * 1024 * 1024
export const PRESENT_ENCODE_1080_WIDTH = 1920
export const PRESENT_ENCODE_4K_WIDTH = 3840
export const PRESENT_ENCODE_MAX_SECONDS = 30
export const PRESENT_ENCODE_BITRATE_1080 = 3_000_000
export const PRESENT_ENCODE_BITRATE_4K = 5_500_000

export function presentVideoFileTooLargeMessage() {
  return 'Choose an MP4, WebM, or MOV video under 1 GB.'
}

export function presentVideoCompressFailedMessage() {
  return `Could not compress that video under ${MAX_PRESENT_VIDEO_MB} MB.`
}

export function evenPresentDimension(value: number) {
  const size = Math.max(2, Math.round(value))
  return size - (size % 2)
}

export function scalePresentVideoSize(width: number, height: number, maxWidth: number) {
  const sourceWidth = Math.max(1, width)
  const sourceHeight = Math.max(1, height)
  const scale = sourceWidth > maxWidth ? maxWidth / sourceWidth : 1
  return {
    width: evenPresentDimension(sourceWidth * scale),
    height: evenPresentDimension(sourceHeight * scale),
  }
}

export function estimatedPresentEncodeBytes(durationSeconds: number, bitsPerSecond: number) {
  return Math.ceil(Math.max(0, durationSeconds) * Math.max(0, bitsPerSecond) / 8)
}

export type PresentVideoEncodePlan =
  | { mode: 'original' }
  | {
      mode: 'encode'
      width: number
      height: number
      durationSeconds: number
      videoBitsPerSecond: number
    }

export function presentVideoEncodePlan(input: {
  sizeBytes: number
  width: number
  height: number
  durationSeconds: number
}): PresentVideoEncodePlan {
  if (input.sizeBytes > 0 && input.sizeBytes <= MAX_PRESENT_VIDEO_BYTES) return { mode: 'original' }
  const sourceDuration = Number.isFinite(input.durationSeconds) ? input.durationSeconds : PRESENT_ENCODE_MAX_SECONDS
  const duration = Math.min(PRESENT_ENCODE_MAX_SECONDS, Math.max(0.5, sourceDuration))
  const keep4k =
    input.width >= 2560 &&
    estimatedPresentEncodeBytes(duration, PRESENT_ENCODE_BITRATE_4K) <= MAX_PRESENT_VIDEO_BYTES
  if (keep4k) {
    return {
      mode: 'encode',
      ...scalePresentVideoSize(input.width, input.height, PRESENT_ENCODE_4K_WIDTH),
      durationSeconds: duration,
      videoBitsPerSecond: PRESENT_ENCODE_BITRATE_4K,
    }
  }
  let seconds = duration
  while (
    seconds > 8 &&
    estimatedPresentEncodeBytes(seconds, PRESENT_ENCODE_BITRATE_1080) > MAX_PRESENT_VIDEO_BYTES
  ) {
    seconds -= 2
  }
  return {
    mode: 'encode',
    ...scalePresentVideoSize(input.width, input.height, PRESENT_ENCODE_1080_WIDTH),
    durationSeconds: seconds,
    videoBitsPerSecond: PRESENT_ENCODE_BITRATE_1080,
  }
}

export function presentVideoEncodeFallback(
  plan: Extract<PresentVideoEncodePlan, { mode: 'encode' }>,
): Extract<PresentVideoEncodePlan, { mode: 'encode' }> {
  if (plan.width > PRESENT_ENCODE_1080_WIDTH) {
    return {
      ...plan,
      ...scalePresentVideoSize(plan.width, plan.height, PRESENT_ENCODE_1080_WIDTH),
      videoBitsPerSecond: PRESENT_ENCODE_BITRATE_1080,
    }
  }
  return {
    ...plan,
    durationSeconds: Math.max(8, Math.floor(plan.durationSeconds / 2)),
    videoBitsPerSecond: Math.max(1_200_000, Math.floor(plan.videoBitsPerSecond * 0.6)),
  }
}

export function presentStreamSrc(id: string) {
  return `/present-media/${encodeURIComponent(id)}`
}

export function presentVideoSrc(id: string) {
  return `/api/backgrounds/media/${encodeURIComponent(id)}`
}

export function presentVideoChunkCount(size: number, chunkBytes = PRESENT_VIDEO_CHUNK_BYTES) {
  return Math.max(1, Math.ceil(Math.max(0, size) / chunkBytes))
}

export function presentVideoStorageChunkCount(size: number) {
  return presentVideoChunkCount(size, PRESENT_VIDEO_STORAGE_CHUNK_BYTES)
}

export function presentVideoChunkUrls(
  baseUrl: string,
  sizeBytes: number,
  chunkBytes = PRESENT_VIDEO_STORAGE_CHUNK_BYTES,
) {
  const count = presentVideoStorageChunkCount(sizeBytes)
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  return Array.from({ length: count }, (_, index) => `${base}${index}`)
}

export function parsePresentByteRange(
  header: string | undefined,
  size: number,
): { start: number; end: number } | null {
  if (!header || size <= 0) return null
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim())
  if (!match) return null
  const rawStart = match[1]
  const rawEnd = match[2]
  if (rawStart === '' && rawEnd === '') return null
  if (rawStart === '') {
    const suffix = Number(rawEnd)
    if (!Number.isFinite(suffix) || suffix <= 0) return null
    const start = Math.max(0, size - suffix)
    return { start, end: size - 1 }
  }
  const start = Number(rawStart)
  const end = rawEnd === '' ? size - 1 : Number(rawEnd)
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= size) {
    return null
  }
  return { start, end: Math.min(end, size - 1) }
}

export function clampPresentStreamRange(
  start: number,
  end: number,
  size: number,
  maxBytes = PRESENT_VIDEO_STREAM_SLICE_BYTES,
) {
  const from = Math.max(0, Math.min(start, size - 1))
  const to = Math.min(size - 1, end, from + maxBytes - 1)
  return { start: from, end: Math.max(from, to) }
}

export function presentChunkRangeFetches(
  start: number,
  end: number,
  chunkBytes: number,
  baseUrl: string,
): Array<{ url: string; start: number; end: number }> {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const first = Math.floor(start / chunkBytes)
  const last = Math.floor(end / chunkBytes)
  const parts: Array<{ url: string; start: number; end: number }> = []
  for (let index = first; index <= last; index++) {
    const chunkStart = index * chunkBytes
    const from = Math.max(0, start - chunkStart)
    const to = Math.min(chunkBytes - 1, end - chunkStart)
    if (from > to) continue
    parts.push({ url: `${base}${index}`, start: from, end: to })
  }
  return parts
}
