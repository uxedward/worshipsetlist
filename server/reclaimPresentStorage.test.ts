import { describe, expect, it } from 'vitest'
import { MAX_PRESENT_VIDEO_BYTES } from '../shared/presentVideo.ts'
import { orphanStoragePrefixes, shouldKeepCustomBackground } from './reclaimPresentStorage.ts'

describe('present storage reclaim', () => {
  it('keeps compact playable clips and drops stubs plus oversized 4K dumps', () => {
    expect(
      shouldKeepCustomBackground({
        id: 'custom-keep',
        src: '/api/backgrounds/media/custom-keep',
        sizeBytes: 4_600_000,
      }),
    ).toBe(true)
    expect(
      shouldKeepCustomBackground({
        id: 'custom-http',
        src: 'https://cdn.example/clip.mp4',
        sizeBytes: 0,
      }),
    ).toBe(true)
    expect(
      shouldKeepCustomBackground({
        id: 'custom-stub',
        src: '/api/backgrounds/media/custom-stub',
        sizeBytes: 0,
      }),
    ).toBe(false)
    expect(
      shouldKeepCustomBackground({
        id: 'custom-huge',
        src: '/api/backgrounds/media/custom-huge',
        sizeBytes: MAX_PRESENT_VIDEO_BYTES + 1,
      }),
    ).toBe(false)
  })

  it('treats storage folders without a kept background as orphans', () => {
    expect(
      orphanStoragePrefixes(
        ['custom-keep', 'custom-orphan/', 'not-a-video', '0'],
        ['custom-keep'],
      ),
    ).toEqual(['custom-orphan'])
  })
})
