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
  })

  it('falls back to dusk for unknown ids', () => {
    expect(findPresentBackground('missing').id).toBe(DEFAULT_PRESENT_BACKGROUND)
  })

  it('persists a chosen background', () => {
    savePresentBackgroundId('ocean-live')
    expect(loadPresentBackgroundId()).toBe('ocean-live')
    savePresentBackgroundId('not-real')
    expect(loadPresentBackgroundId()).toBe('ocean-live')
  })
})
