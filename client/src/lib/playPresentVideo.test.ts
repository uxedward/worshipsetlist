import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  chunkUrlsForBackground,
  resetPresentVideoPlayCache,
  resolvePlayablePresentSrc,
} from './playPresentVideo.ts'
import type { PresentBackground } from './presentBackgrounds.ts'
import { findPresentBackground } from './presentBackgrounds.ts'
import { readLocalVideoFile } from './customPresentBackgrounds.ts'
import { presentStreamUrl } from './presentVideoSw.ts'

vi.mock('./presentVideoSw.ts', () => ({
  presentStreamUrl: vi.fn(async (background: PresentBackground) =>
    background.chunkBaseUrl ? `/present-media/${background.id}` : undefined,
  ),
}))

vi.mock('./customPresentBackgrounds.ts', async () => {
  const actual = await vi.importActual<typeof import('./customPresentBackgrounds.ts')>(
    './customPresentBackgrounds.ts',
  )
  return {
    ...actual,
    readLocalVideoFile: vi.fn(async () => undefined),
    cacheLocalVideoFile: vi.fn(async () => undefined),
  }
})

const custom: PresentBackground = {
  id: 'custom-a',
  label: 'Sunrise',
  kind: 'video',
  group: 'motion',
  custom: true,
  src: '/api/backgrounds/media/custom-a',
  sizeBytes: 8 * 1024 * 1024 + 1,
  chunkBaseUrl: 'https://cdn.example/present-videos/custom-a/',
}

describe('play present video', () => {
  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => `blob:http://localhost/${Math.random().toString(16).slice(2)}`),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    })
  })

  afterEach(() => {
    resetPresentVideoPlayCache()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('builds public chunk URLs from the storage prefix', () => {
    expect(chunkUrlsForBackground(custom)).toEqual([
      'https://cdn.example/present-videos/custom-a/0',
      'https://cdn.example/present-videos/custom-a/1',
    ])
  })

  it('plays ocean live from the 1080p file, not the 4K encode', async () => {
    const ocean = findPresentBackground('ocean-live')
    await expect(resolvePlayablePresentSrc(ocean)).resolves.toBe(ocean.src)
    expect(ocean.src).toContain('ocean.mp4')
    expect(ocean.src).not.toContain('ocean-4k')
  })

  it('plays hosted clips through the same-origin stream when the worker answers as video', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo) => {
        const url = String(input)
        if (url.includes('/present-media/')) {
          return new Response(new Uint8Array(16), {
            status: 206,
            headers: {
              'Content-Type': 'video/mp4',
              'Content-Range': 'bytes 0-15/100',
            },
          })
        }
        return new Response('missing', { status: 404 })
      }),
    )
    await expect(resolvePlayablePresentSrc(custom)).resolves.toBe('/present-media/custom-a')
  })

  it('assembles storage chunks when the stream is HTML instead of video', async () => {
    vi.mocked(presentStreamUrl).mockResolvedValueOnce('/present-media/custom-a')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo) => {
        const url = String(input)
        if (url.includes('/present-media/')) {
          return new Response('<html>app</html>', {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
          })
        }
        return new Response(new Uint8Array(8), {
          status: 200,
          headers: { 'Content-Type': 'video/mp4' },
        })
      }),
    )
    const src = await resolvePlayablePresentSrc(custom)
    expect(src).toMatch(/^blob:/)
  })

  it('keeps a local blob URL so a just-uploaded clip plays immediately', async () => {
    await expect(
      resolvePlayablePresentSrc({ ...custom, src: 'blob:http://localhost/1' }),
    ).resolves.toBe('blob:http://localhost/1')
  })

  it('plays a cached IndexedDB file when the stream is unavailable', async () => {
    vi.mocked(presentStreamUrl).mockResolvedValueOnce(undefined)
    vi.mocked(readLocalVideoFile).mockResolvedValueOnce(
      new File([new Uint8Array(32)], 'sunrise.mp4', { type: 'video/mp4' }),
    )
    const src = await resolvePlayablePresentSrc({ ...custom, chunkBaseUrl: undefined, id: 'custom-idb' })
    expect(src).toMatch(/^blob:/)
  })
})
