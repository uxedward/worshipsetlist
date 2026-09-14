import { describe, expect, it } from 'vitest'
import { parseByteRange, sliceChunkRange } from './backgroundMedia.ts'

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
})
