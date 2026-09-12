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

  it('includes still photos and live motion clips', () => {
    const kinds = new Set(PRESENT_BACKGROUNDS.map((bg) => bg.kind))
    expect(kinds).toEqual(new Set(['gradient', 'photo', 'video']))
    expect(PRESENT_BACKGROUNDS.filter((bg) => bg.group === 'still').length).toBeGreaterThanOrEqual(5)
    expect(PRESENT_BACKGROUNDS.filter((bg) => bg.kind === 'video')).toHaveLength(4)
    expect(PRESENT_BACKGROUNDS.filter((bg) => bg.kind === 'video').every((bg) => bg.src4k?.includes('-4k.mp4'))).toBe(true)
    expect(PRESENT_BACKGROUNDS.filter((bg) => bg.kind === 'photo').every((bg) => bg.src?.includes('.jpg'))).toBe(true)
  })

  it('picks 4K video on retina / projector canvases and 1080p on phones', () => {
    const ocean = findPresentBackground('ocean-live')
    expect(pickPresentVideoSrc(ocean, { width: 390, height: 844, dpr: 3 })).toBe(ocean.src)
    expect(pickPresentVideoSrc(ocean, { width: 1920, height: 1080, dpr: 1 })).toBe(ocean.src4k)
    expect(pickPresentVideoSrc(ocean, { width: 1440, height: 900, dpr: 2 })).toBe(ocean.src4k)
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
      'violet',
      'blush',
      'dusk',
    ])
    expect(gradients.every((bg) => bg.fill?.startsWith('var(--present-'))).toBe(true)
  })

  it('persists a chosen background', () => {
    savePresentBackgroundId('ocean-live')
    expect(loadPresentBackgroundId()).toBe('ocean-live')
    savePresentBackgroundId('not-real')
    expect(loadPresentBackgroundId()).toBe('ocean-live')
  })
})
