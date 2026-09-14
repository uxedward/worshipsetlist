import { describe, expect, it } from 'vitest'
import {
  PRESENT_VIDEO_STORAGE_CHUNK_BYTES,
  presentVideoChunkCount,
  presentVideoSrc,
  presentVideoStorageChunkCount,
} from './presentVideo.ts'

describe('present video helpers', () => {
  it('builds a same-origin database media URL', () => {
    expect(presentVideoSrc('custom-abc')).toBe('/api/backgrounds/media/custom-abc')
  })

  it('splits a 4K file into 2MB database chunks', () => {
    expect(presentVideoChunkCount(0)).toBe(1)
    expect(presentVideoChunkCount(2 * 1024 * 1024)).toBe(1)
    expect(presentVideoChunkCount(2 * 1024 * 1024 + 1)).toBe(2)
  })

  it('splits 4K files into storage parts under the 50MB object cap', () => {
    const fourK = 400 * 1024 * 1024
    expect(presentVideoStorageChunkCount(fourK)).toBe(50)
    expect(PRESENT_VIDEO_STORAGE_CHUNK_BYTES).toBeLessThan(50 * 1024 * 1024)
    expect(presentVideoChunkCount(8 * 1024 * 1024 + 1, PRESENT_VIDEO_STORAGE_CHUNK_BYTES)).toBe(2)
  })
})
