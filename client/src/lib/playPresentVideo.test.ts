import { afterEach, describe, expect, it, vi } from 'vitest'
import { chunkUrlsForBackground, downloadViaRange, resolvePlayablePresentSrc } from './playPresentVideo.ts'
import type { PresentBackground } from './presentBackgrounds.ts'

vi.mock('./customPresentBackgrounds.ts', () => ({
  readLocalVideoFile: vi.fn(async () => undefined),
  cacheLocalVideoFile: vi.fn(async () => undefined),
}))

const custom: PresentBackground = {
  id: 'custom-a',
  label: 'Sunrise',
  kind: 'video',
  group: 'motion',
  custom: true,
  src: '/api/backgrounds/media/custom-a',
  sizeBytes: 6,
  chunkBaseUrl: 'https://cdn.example/present-videos/custom-a/',
}

if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'blob:play-present-video'
  URL.revokeObjectURL = () => undefined
}

describe('play present video', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('builds public chunk URLs from the storage prefix', () => {
    expect(chunkUrlsForBackground({ ...custom, sizeBytes: 8 * 1024 * 1024 + 1 })).toEqual([
      'https://cdn.example/present-videos/custom-a/0',
      'https://cdn.example/present-videos/custom-a/1',
    ])
  })

  it('stitches storage parts into a playable blob URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const body = url.endsWith('/0') ? 'aaaa' : 'bb'
        return new Response(body, { status: 200 })
      }),
    )
    const src = await resolvePlayablePresentSrc({ ...custom, sizeBytes: 8 * 1024 * 1024 + 1 })
    expect(src?.startsWith('blob:')).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('downloads range slices when public chunks are missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const range = String((init?.headers as Record<string, string> | undefined)?.Range || '')
        expect(range.startsWith('bytes=')).toBe(true)
        return new Response('x', { status: 206 })
      }),
    )
    const file = await downloadViaRange('/api/backgrounds/media/custom-a', 4)
    expect(file.size).toBeGreaterThan(0)
  })
})
