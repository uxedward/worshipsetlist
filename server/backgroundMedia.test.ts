import { describe, expect, it } from 'vitest'
import { parseByteRange, presentVideoUploadTooLarge, sliceChunkRange } from './backgroundMedia.ts'
import { PRESENT_VIDEO_STORAGE_CHUNK_BYTES } from '../shared/presentVideo.ts'

describe('background media ranges', () => {
  it('parses suffix, open-ended, and closed byte ranges', () => {
    expect(parseByteRange('bytes=0-99', 200)).toEqual({ start: 0, end: 99 })
    expect(parseByteRange('bytes=150-', 200)).toEqual({ start: 150, end: 199 })
    expect(parseByteRange('bytes=-20', 200)).toEqual({ start: 180, end: 199 })
    expect(parseByteRange('bytes=200-201', 200)).toBeNull()
  })

  it('slices stored 1MB chunks without loading the whole video', () => {
    const chunkSize = 8
    const chunks = [
      { index: 0, data: Buffer.from('abcdefgh') },
      { index: 1, data: Buffer.from('ijklmnop') },
      { index: 2, data: Buffer.from('qr') },
    ]
    expect(sliceChunkRange(chunks, 6, 11, chunkSize).toString()).toBe('ghijkl')
    expect(sliceChunkRange(chunks, 16, 17, chunkSize).toString()).toBe('qr')
  })

  it('rejects a 1GB-style upload whose parts would refill Storage', () => {
    expect(presentVideoUploadTooLarge(1, PRESENT_VIDEO_STORAGE_CHUNK_BYTES, 4_600_000)).toBe(false)
    expect(presentVideoUploadTooLarge(5, PRESENT_VIDEO_STORAGE_CHUNK_BYTES, PRESENT_VIDEO_STORAGE_CHUNK_BYTES)).toBe(
      false,
    )
    expect(presentVideoUploadTooLarge(128, PRESENT_VIDEO_STORAGE_CHUNK_BYTES, PRESENT_VIDEO_STORAGE_CHUNK_BYTES)).toBe(
      true,
    )
  })
})
