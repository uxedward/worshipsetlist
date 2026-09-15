import { describe, expect, it } from 'vitest'
import {
  PRESENT_VIDEO_STORAGE_CHUNK_BYTES,
  clampPresentStreamRange,
  parsePresentByteRange,
  presentChunkRangeFetches,
  presentStreamSrc,
  presentVideoChunkCount,
  presentVideoChunkUrls,
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

  it('builds public storage URLs for each 8MB part of a 4K file', () => {
    const urls = presentVideoChunkUrls(
      'https://example.supabase.co/storage/v1/object/public/present-videos/custom-a',
      8 * 1024 * 1024 + 1,
    )
    expect(urls).toEqual([
      'https://example.supabase.co/storage/v1/object/public/present-videos/custom-a/0',
      'https://example.supabase.co/storage/v1/object/public/present-videos/custom-a/1',
    ])
  })

  it('maps a 4K byte range onto the matching public Storage parts', () => {
    expect(presentStreamSrc('custom-abc')).toBe('/present-media/custom-abc')
    expect(parsePresentByteRange('bytes=0-', 100)).toEqual({ start: 0, end: 99 })
    expect(clampPresentStreamRange(0, 99, 100, 8)).toEqual({ start: 0, end: 7 })
    expect(
      presentChunkRangeFetches(8 * 1024 * 1024 - 4, 8 * 1024 * 1024 + 4, 8 * 1024 * 1024, 'https://cdn.example/a/'),
    ).toEqual([
      { url: 'https://cdn.example/a/0', start: 8 * 1024 * 1024 - 4, end: 8 * 1024 * 1024 - 1 },
      { url: 'https://cdn.example/a/1', start: 0, end: 4 },
    ])
  })
})
