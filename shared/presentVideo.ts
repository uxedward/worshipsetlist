/** Small enough to fit a Vercel function body when storage is unavailable. */
export const PRESENT_VIDEO_CHUNK_BYTES = 2 * 1024 * 1024
/** Hosted Storage rejects objects around 50MB; keep each part well under that cap. */
export const PRESENT_VIDEO_STORAGE_CHUNK_BYTES = 8 * 1024 * 1024
export const PRESENT_VIDEO_RANGE_MAX_BYTES = 3 * 1024 * 1024
/** First open-ended Range from the video element; one Storage part, enough to start 4K. */
export const PRESENT_VIDEO_STREAM_SLICE_BYTES = PRESENT_VIDEO_STORAGE_CHUNK_BYTES

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
