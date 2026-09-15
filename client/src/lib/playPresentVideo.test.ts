import { afterEach, describe, expect, it, vi } from 'vitest'
import { chunkUrlsForBackground, resolvePlayablePresentSrc } from './playPresentVideo.ts'
import type { PresentBackground } from './presentBackgrounds.ts'

vi.mock('./presentVideoSw.ts', () => ({
  presentStreamUrl: vi.fn(async (background: PresentBackground) =>
    background.chunkBaseUrl ? `/present-media/${background.id}` : undefined,
  ),
}))

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
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('builds public chunk URLs from the storage prefix', () => {
    expect(chunkUrlsForBackground(custom)).toEqual([
      'https://cdn.example/present-videos/custom-a/0',
      'https://cdn.example/present-videos/custom-a/1',
    ])
  })

  it('plays 4K through the same-origin stream instead of downloading the whole file', async () => {
    await expect(resolvePlayablePresentSrc(custom)).resolves.toBe('/present-media/custom-a')
  })

  it('keeps a local blob URL so a just-uploaded clip plays immediately', async () => {
    await expect(
      resolvePlayablePresentSrc({ ...custom, src: 'blob:http://localhost/1' }),
    ).resolves.toBe('blob:http://localhost/1')
  })
})
