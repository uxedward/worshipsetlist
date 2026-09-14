import type { IncomingMessage } from 'node:http'
import { prisma } from './db.ts'
import {
  deleteSupabasePrefix,
  downloadStorageObject,
  localPublicSrc,
  sanitizeBackgroundId,
  sanitizeFilename,
  storageChunkObjectPath,
  storageObjectSize,
  supabaseConfig,
  uploadSupabaseObject,
} from './videoHosting.ts'
import { PRESENT_VIDEO_CHUNK_BYTES, PRESENT_VIDEO_RANGE_MAX_BYTES } from '../shared/presentVideo.ts'

export { PRESENT_VIDEO_CHUNK_BYTES, PRESENT_VIDEO_RANGE_MAX_BYTES }

const MAX_CHUNK_BYTES = PRESENT_VIDEO_CHUNK_BYTES + 64 * 1024

export function mimeFromFilename(name: string) {
  const lower = sanitizeFilename(name).toLowerCase()
  if (lower.endsWith('.webm')) return 'video/webm'
  if (lower.endsWith('.mov')) return 'video/quicktime'
  if (lower.endsWith('.m4v')) return 'video/x-m4v'
  return 'video/mp4'
}

export function parseByteRange(header: string | undefined, size: number): { start: number; end: number } | null {
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
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= size) return null
  return { start, end: Math.min(end, size - 1) }
}

export function sliceChunkRange(
  chunks: Array<{ index: number; data: Buffer }>,
  start: number,
  end: number,
  chunkSize = PRESENT_VIDEO_CHUNK_BYTES,
): Buffer {
  const first = Math.floor(start / chunkSize)
  const last = Math.floor(end / chunkSize)
  const parts: Buffer[] = []
  for (let index = first; index <= last; index++) {
    const chunk = chunks.find((item) => item.index === index)
    if (!chunk) throw new Error('Missing video chunk')
    const chunkStart = index * chunkSize
    const from = Math.max(0, start - chunkStart)
    const to = Math.min(chunk.data.length, end - chunkStart + 1)
    parts.push(chunk.data.subarray(from, to))
  }
  return Buffer.concat(parts)
}

export async function readRequestBuffer(req: IncomingMessage, maxBytes = MAX_CHUNK_BYTES) {
  const parts: Buffer[] = []
  let size = 0
  for await (const part of req) {
    const buf = Buffer.isBuffer(part) ? part : Buffer.from(part)
    size += buf.length
    if (size > maxBytes) throw new Error('That video chunk is too large.')
    parts.push(buf)
  }
  return Buffer.concat(parts)
}

function labelFromFilename(name: string) {
  const base = sanitizeFilename(name).replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
  if (!base) return 'Uploaded video'
  return base.replace(/\b\w/g, (ch) => ch.toUpperCase())
}

export async function saveBackgroundChunk(options: {
  id: string
  filename?: string
  mimeType?: string
  chunkIndex: number
  chunkCount: number
  data: Buffer
}) {
  const id = sanitizeBackgroundId(options.id)
  const chunkIndex = Math.max(0, Math.floor(options.chunkIndex))
  const chunkCount = Math.max(1, Math.floor(options.chunkCount))
  if (chunkIndex >= chunkCount) throw new Error('That video chunk is out of range.')
  const filename = options.filename || `${id}.mp4`
  const mimeType = options.mimeType || mimeFromFilename(filename)
  const src = localPublicSrc(id)

  await prisma.customBackground.upsert({
    where: { id },
    create: {
      id,
      label: labelFromFilename(filename),
      kind: 'video',
      src,
      mimeType,
      sizeBytes: 0,
    },
    update: {
      src,
      mimeType,
    },
  })

  if (supabaseConfig()) {
    if (chunkIndex === 0) {
      await deleteSupabasePrefix(id)
      await prisma.backgroundChunk.deleteMany({ where: { backgroundId: id } }).catch(() => {
        /* BYTEA leftovers are optional */
      })
    }
    await uploadSupabaseObject(storageChunkObjectPath(id, chunkIndex), options.data, mimeType)
    if (chunkIndex === chunkCount - 1) {
      let sizeBytes = options.data.length
      if (chunkCount > 1) {
        const firstSize = await storageObjectSize(storageChunkObjectPath(id, 0))
        if (firstSize && firstSize > 0) sizeBytes = firstSize * (chunkCount - 1) + options.data.length
      }
      await prisma.customBackground.update({
        where: { id },
        data: { sizeBytes, src, mimeType },
      })
    }
    return { src, src4k: src, chunkIndex, chunkCount }
  }

  if (chunkIndex === 0) {
    await prisma.backgroundChunk.deleteMany({ where: { backgroundId: id } })
  }

  await prisma.backgroundChunk.upsert({
    where: { backgroundId_index: { backgroundId: id, index: chunkIndex } },
    create: { backgroundId: id, index: chunkIndex, data: new Uint8Array(options.data) },
    update: { data: new Uint8Array(options.data) },
  })

  if (chunkIndex === chunkCount - 1) {
    const totals = await prisma.$queryRaw<Array<{ size: bigint | number | string }>>`
      SELECT COALESCE(SUM(octet_length(data)), 0) AS size
      FROM "BackgroundChunk"
      WHERE "backgroundId" = ${id}
    `
    const sizeBytes = Number(totals[0]?.size ?? 0)
    await prisma.customBackground.update({
      where: { id },
      data: { sizeBytes, src, mimeType },
    })
  }

  return { src, src4k: src, chunkIndex, chunkCount }
}

export async function deleteBackgroundMedia(id: string) {
  try {
    const safeId = sanitizeBackgroundId(id)
    await deleteSupabasePrefix(safeId)
    await prisma.backgroundChunk.deleteMany({ where: { backgroundId: safeId } })
  } catch {
    /* row may already be gone */
  }
}

async function readStoredRange(id: string, start: number, end: number, size: number) {
  if (!supabaseConfig()) return null
  const firstSize = await storageObjectSize(storageChunkObjectPath(id, 0))
  if (!firstSize || firstSize <= 0) return null
  const chunkSize = firstSize >= size ? size : firstSize
  const first = Math.floor(start / chunkSize)
  const last = Math.floor(end / chunkSize)
  const parts: Array<{ index: number; data: Buffer }> = []
  for (let index = first; index <= last; index++) {
    const data = await downloadStorageObject(storageChunkObjectPath(id, index))
    if (!data) return null
    parts.push({ index, data })
  }
  return sliceChunkRange(parts, start, end, chunkSize)
}

export async function readBackgroundRange(id: string, rangeHeader?: string) {
  const safeId = sanitizeBackgroundId(id)
  const row = await prisma.customBackground.findUnique({
    where: { id: safeId },
    select: { mimeType: true, sizeBytes: true, src: true },
  })
  if (!row || row.sizeBytes <= 0) return null

  const size = row.sizeBytes
  const requested = parseByteRange(rangeHeader, size)
  const start = requested?.start ?? 0
  let end = requested?.end ?? size - 1
  if (!requested) {
    end = Math.min(end, start + PRESENT_VIDEO_RANGE_MAX_BYTES - 1)
  } else {
    end = Math.min(end, start + PRESENT_VIDEO_RANGE_MAX_BYTES - 1)
  }

  const stored = await readStoredRange(safeId, start, end, size)
  if (stored) {
    return {
      body: stored,
      start,
      end,
      size,
      mimeType: row.mimeType || 'video/mp4',
      partial: start !== 0 || end !== size - 1,
    }
  }

  const chunkSize = PRESENT_VIDEO_CHUNK_BYTES
  const first = Math.floor(start / chunkSize)
  const last = Math.floor(end / chunkSize)
  const chunks = await prisma.backgroundChunk.findMany({
    where: { backgroundId: safeId, index: { gte: first, lte: last } },
    orderBy: { index: 'asc' },
    select: { index: true, data: true },
  })
  const body = sliceChunkRange(
    chunks.map((chunk) => ({ index: chunk.index, data: Buffer.from(chunk.data) })),
    start,
    end,
    chunkSize,
  )
  return {
    body,
    start,
    end,
    size,
    mimeType: row.mimeType || 'video/mp4',
    partial: start !== 0 || end !== size - 1,
  }
}
