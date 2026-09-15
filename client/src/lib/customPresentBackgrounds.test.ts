import { describe, expect, it, beforeEach } from 'vitest'
import {
  CUSTOM_BG_META_KEY,
  CUSTOM_BG_PREFIX,
  asVideoFile,
  isAllowedVideoFile,
  isCustomBackgroundId,
  isHostedBackgroundSrc,
  labelFromVideoName,
  mergeCustomBackgrounds,
  readCustomBackgroundMeta,
  rememberRemoteBackground,
} from './customPresentBackgrounds.ts'

const memory = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value)
    },
    removeItem: (key: string) => {
      memory.delete(key)
    },
    clear: () => memory.clear(),
  },
  configurable: true,
})

describe('custom present backgrounds', () => {
  beforeEach(() => {
    memory.clear()
  })

  it('labels an uploaded file from its name', () => {
    expect(labelFromVideoName('sunday_sunrise.mp4')).toBe('Sunday Sunrise')
    expect(labelFromVideoName('.mp4')).toBe('Uploaded video')
  })

  it('accepts video files and rejects empty ones', () => {
    expect(isAllowedVideoFile(new File([new Uint8Array([1, 2, 3])], 'clip.mp4', { type: 'video/mp4' }))).toBe(true)
    expect(isAllowedVideoFile(new File([], 'clip.mp4', { type: 'video/mp4' }))).toBe(false)
    expect(isAllowedVideoFile(new File([new Uint8Array([1])], 'notes.pdf', { type: 'application/pdf' }))).toBe(false)
  })

  it('restores a nameless IndexedDB blob as an uploadable video file', () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'video/mp4' })
    const file = asVideoFile(blob, 'cool-rainbow.mp4')
    expect(file).toBeInstanceOf(File)
    expect(file.name).toBe('cool-rainbow.mp4')
    expect(file.type).toBe('video/mp4')
    expect(isAllowedVideoFile(file)).toBe(true)
  })

  it('merges remote uploads over local copies of the same id', () => {
    memory.set(
      CUSTOM_BG_META_KEY,
      JSON.stringify([
        { id: `${CUSTOM_BG_PREFIX}a`, label: 'Local', kind: 'video', group: 'motion', custom: true },
      ]),
    )
    const local = readCustomBackgroundMeta()
    const merged = mergeCustomBackgrounds(local, [
      {
        id: `${CUSTOM_BG_PREFIX}a`,
        label: 'Sunrise',
        kind: 'video',
        group: 'motion',
        src: 'https://example.com/sunrise.mp4',
        custom: true,
      },
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0].src).toBe('https://example.com/sunrise.mp4')
    expect(merged[0].src4k).toBe('https://example.com/sunrise.mp4')
    expect(merged[0].label).toBe('Sunrise')
  })

  it('keeps a local blob playing after the shared library URL arrives', () => {
    const merged = mergeCustomBackgrounds(
      [
        {
          id: `${CUSTOM_BG_PREFIX}a`,
          label: 'Local',
          kind: 'video',
          group: 'motion',
          src: 'blob:http://localhost/1',
          custom: true,
        },
      ],
      [
        {
          id: `${CUSTOM_BG_PREFIX}a`,
          label: 'Shared',
          kind: 'video',
          group: 'motion',
          src: '/api/backgrounds/media/custom-a',
          custom: true,
          chunkBaseUrl: 'https://example.supabase.co/storage/v1/object/public/present-videos/custom-a/',
          sizeBytes: 12,
        },
      ],
    )
    expect(merged[0].src).toBe('blob:http://localhost/1')
    expect(merged[0].src4k).toBe('blob:http://localhost/1')
    expect(merged[0].label).toBe('Shared')
    expect(merged[0].chunkBaseUrl).toContain('present-videos/custom-a/')
    expect(merged[0].sizeBytes).toBe(12)
  })

  it('marks uploaded ids as custom', () => {
    expect(isCustomBackgroundId(`${CUSTOM_BG_PREFIX}abc`)).toBe(true)
    expect(isCustomBackgroundId('ocean-live')).toBe(false)
  })

  it('treats database media paths as shared across browsers', () => {
    expect(isHostedBackgroundSrc('https://cdn.example/clip.mp4')).toBe(true)
    expect(isHostedBackgroundSrc('/api/backgrounds/media/custom-a')).toBe(true)
    expect(isHostedBackgroundSrc('blob:http://localhost/1')).toBe(false)
  })

  it('keeps a hosted upload even if IndexedDB cleanup fails', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: {
        open() {
          throw new Error('IndexedDB blocked')
        },
      },
    })
    await expect(
      rememberRemoteBackground({
        id: `${CUSTOM_BG_PREFIX}a`,
        label: 'Sunrise',
        kind: 'video',
        group: 'motion',
        src: 'https://example.com/sunrise.mp4',
        custom: true,
      }),
    ).resolves.toBeUndefined()
    expect(readCustomBackgroundMeta()[0]?.src).toBe('https://example.com/sunrise.mp4')
  })
})
