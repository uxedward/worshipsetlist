import { describe, expect, it, vi } from 'vitest'
import { MAX_PRESENT_VIDEO_BYTES } from '@shared/presentVideo.ts'
import { compressPresentVideoFile } from './compressPresentVideo.ts'

describe('compressPresentVideoFile', () => {
  it('skips encoding when the clip already fits in Storage', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'ocean-4k.mp4', { type: 'video/mp4' })
    Object.defineProperty(file, 'size', { value: 8 * 1024 * 1024 })
    await expect(compressPresentVideoFile(file)).resolves.toBe(file)
  })

  it('does not invent a MediaRecorder when the source is already under 40 MB', async () => {
    const recorder = vi.fn()
    vi.stubGlobal('MediaRecorder', recorder)
    const file = new File([new Uint8Array([1])], 'clip.mp4', { type: 'video/mp4' })
    Object.defineProperty(file, 'size', { value: MAX_PRESENT_VIDEO_BYTES })
    await expect(compressPresentVideoFile(file)).resolves.toBe(file)
    expect(recorder).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
