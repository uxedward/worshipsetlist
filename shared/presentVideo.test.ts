import { describe, expect, it } from 'vitest'
import { presentVideoChunkCount, presentVideoSrc } from './presentVideo.ts'

describe('present video helpers', () => {
  it('builds a same-origin database media URL', () => {
    expect(presentVideoSrc('custom-abc')).toBe('/api/backgrounds/media/custom-abc')
  })

  it('splits a 4K file into 2MB database chunks', () => {
    expect(presentVideoChunkCount(0)).toBe(1)
    expect(presentVideoChunkCount(2 * 1024 * 1024)).toBe(1)
    expect(presentVideoChunkCount(2 * 1024 * 1024 + 1)).toBe(2)
  })
})
