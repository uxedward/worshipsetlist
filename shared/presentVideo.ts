/** Small enough to fit a Vercel function body when storage is unavailable. */
export const PRESENT_VIDEO_CHUNK_BYTES = 2 * 1024 * 1024
/** Hosted Storage rejects objects around 50MB; keep each part well under that cap. */
export const PRESENT_VIDEO_STORAGE_CHUNK_BYTES = 8 * 1024 * 1024
export const PRESENT_VIDEO_RANGE_MAX_BYTES = 3 * 1024 * 1024

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
