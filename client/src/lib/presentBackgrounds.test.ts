import { describe, expect, it, beforeEach } from 'vitest'

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
})

import {
  DEFAULT_PRESENT_BACKGROUND,
  PRESENT_BACKGROUNDS,
  findPresentBackground,
  loadPresentBackgroundId,
  savePresentBackgroundId,
  pickPresentVideoSrc,
} from './presentBackgrounds.ts'

describe('present backgrounds', () => {
  beforeEach(() => {
    memory.clear()
  })

  it('keeps ocean live as the only built-in video and has no still photos', () => {
    const kinds = new Set(PRESENT_BACKGROUNDS.map((bg) => bg.kind))
    expect(kinds).toEqual(new Set(['gradient', 'video']))
    expect(PRESENT_BACKGROUNDS.filter((bg) => bg.kind === 'video').map((bg) => bg.id)).toEqual(['ocean-live'])
    expect(PRESENT_BACKGROUNDS.find((bg) => bg.id === 'ocean-live')?.src4k).toContain('ocean-4k.mp4')
    expect(PRESENT_BACKGROUNDS.some((bg) => bg.kind === 'photo')).toBe(false)
  })

  it('maps retired stills and extra live clips to ocean live', () => {
    expect(findPresentBackground('ocean').id).toBe('ocean-live')
    expect(findPresentBackground('sky').id).toBe('ocean-live')
    expect(findPresentBackground('mountains-live').id).toBe('ocean-live')
    expect(findPresentBackground('lake-live').id).toBe('ocean-live')
  })

  it('picks 4K video on retina / projector canvases and 1080p on phones', () => {
    const ocean = findPresentBackground('ocean-live')
    expect(pickPresentVideoSrc(ocean, { width: 390, height: 844, dpr: 3 })).toBe(ocean.src)
    expect(pickPresentVideoSrc(ocean, { width: 1920, height: 1080, dpr: 1 })).toBe(ocean.src4k)
    expect(pickPresentVideoSrc(ocean, { width: 1440, height: 900, dpr: 2 })).toBe(ocean.src4k)
  })

  it('keeps uploaded videos at full 4K resolution on every canvas', () => {
    const custom = {
      id: 'custom-sunrise',
      label: 'Sunrise',
      kind: 'video' as const,
      group: 'motion' as const,
      src: 'https://cdn.example/sunrise.mp4',
      src4k: 'https://cdn.example/sunrise.mp4',
      custom: true,
    }
    expect(pickPresentVideoSrc(custom, { width: 390, height: 844, dpr: 3 })).toBe(custom.src)
    expect(pickPresentVideoSrc(custom, { width: 1920, height: 1080, dpr: 1 })).toBe(custom.src4k)
  })

  it('falls back to horizon for unknown ids', () => {
    expect(findPresentBackground('missing').id).toBe(DEFAULT_PRESENT_BACKGROUND)
    expect(DEFAULT_PRESENT_BACKGROUND).toBe('horizon')
  })

  it('ships warm stage gradients plus dusk', () => {
    const gradients = PRESENT_BACKGROUNDS.filter((bg) => bg.kind === 'gradient')
    expect(gradients.map((bg) => bg.id)).toEqual([
      'horizon',
      'afterglow',
      'ember',
      'canyon',
      'violet',
      'blush',
      'dusk',
    ])
    expect(gradients.every((bg) => bg.fill?.startsWith('var(--present-'))).toBe(true)
    expect(findPresentBackground('canyon').fill).toBe('var(--present-canyon)')
  })

  it('persists a chosen background, including custom ids', () => {
    savePresentBackgroundId('ocean-live')
    expect(loadPresentBackgroundId()).toBe('ocean-live')
    savePresentBackgroundId('custom-sunset')
    expect(loadPresentBackgroundId()).toBe('custom-sunset')
    savePresentBackgroundId('')
    expect(loadPresentBackgroundId()).toBe('custom-sunset')
  })

  it('resolves custom backgrounds from extras', () => {
    const extras = [
      {
        id: 'custom-sunset',
        label: 'Sunset',
        kind: 'video' as const,
        group: 'motion' as const,
        src: 'blob:test',
        custom: true,
      },
    ]
    expect(findPresentBackground('custom-sunset', extras).label).toBe('Sunset')
  })
})
