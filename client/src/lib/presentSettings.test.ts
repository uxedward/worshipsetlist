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
  DEFAULT_PRESENT_SETTINGS,
  FONT_MAX,
  FONT_MIN,
  clampPresentSettings,
  coarseFontSize,
  fittedFontSize,
  loadPresentSettings,
  lyricPlateColor,
  lyricTextShadow,
  savePresentSettings,
  screenVeil,
} from './presentSettings.ts'

describe('present settings', () => {
  beforeEach(() => {
    memory.clear()
  })

  it('clamps out-of-range values', () => {
    expect(clampPresentSettings({ fontSize: 9, lineWidth: 200, overlay: -4, shadow: 140 })).toEqual({
      fontSize: FONT_MIN,
      lineWidth: 94,
      overlay: 0,
      shadow: 100,
    })
  })

  it('persists and reloads settings', () => {
    savePresentSettings({ fontSize: 40, lineWidth: 72, overlay: 80, shadow: 20 })
    expect(loadPresentSettings()).toEqual({ fontSize: 40, lineWidth: 72, overlay: 80, shadow: 20 })
  })

  it('returns defaults when storage is empty or corrupt', () => {
    expect(loadPresentSettings()).toEqual(DEFAULT_PRESENT_SETTINGS)
    memory.set('setflow.presentSettings', '{not json')
    expect(loadPresentSettings()).toEqual(DEFAULT_PRESENT_SETTINGS)
  })

  it('shrinks font so a long line fits the four-line width', () => {
    expect(fittedFontSize(52, 400, 800)).toBe(52)
    expect(fittedFontSize(52, 1040, 800)).toBe(40)
    expect(fittedFontSize(52, 8000, 800)).toBe(FONT_MIN)
  })

  it('maps pixel size onto the saved small/medium/large preference', () => {
    expect(coarseFontSize(36)).toBe('small')
    expect(coarseFontSize(52)).toBe('medium')
    expect(coarseFontSize(68)).toBe('large')
  })

  it('builds overlay and shadow styles from slider values', () => {
    expect(lyricTextShadow(0)).toBe('none')
    expect(lyricTextShadow(60)).toContain('rgba(0,0,0')
    expect(lyricPlateColor(0)).toBe('rgba(6,3,2,0.000)')
    expect(lyricPlateColor(100)).toBe('rgba(6,3,2,0.840)')
    expect(screenVeil(50, true)).toBe('transparent')
    expect(screenVeil(50, false)).toContain('linear-gradient')
  })
})
