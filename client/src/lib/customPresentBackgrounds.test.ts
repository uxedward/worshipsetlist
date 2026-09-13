import { describe, expect, it, beforeEach } from 'vitest'
import {
  CUSTOM_BG_META_KEY,
  CUSTOM_BG_PREFIX,
  isAllowedVideoFile,
  isCustomBackgroundId,
  labelFromVideoName,
  mergeCustomBackgrounds,
  readCustomBackgroundMeta,
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
    expect(merged[0].label).toBe('Sunrise')
  })

  it('marks uploaded ids as custom', () => {
    expect(isCustomBackgroundId(`${CUSTOM_BG_PREFIX}abc`)).toBe(true)
    expect(isCustomBackgroundId('ocean-live')).toBe(false)
  })
})
