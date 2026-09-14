/** Small enough to fit a Vercel function body, large enough to keep 4K uploads moving. */
export const PRESENT_VIDEO_CHUNK_BYTES = 1024 * 1024
export const PRESENT_VIDEO_RANGE_MAX_BYTES = 3 * 1024 * 1024

export function presentVideoSrc(id: string) {
  return `/api/backgrounds/media/${encodeURIComponent(id)}`
}

export function presentVideoChunkCount(size: number) {
  return Math.max(1, Math.ceil(Math.max(0, size) / PRESENT_VIDEO_CHUNK_BYTES))
}
