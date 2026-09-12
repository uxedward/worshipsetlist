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
  PRESENT_FONTS,
  clampPresentSettings,
  coarseFontSize,
  findPresentFont,
  fittedFontSize,
  loadPresentSettings,
  lyricTextShadow,
  presentFontFamily,
  savePresentSettings,
} from './presentSettings.ts'

describe('present settings', () => {
  beforeEach(() => {
    memory.clear()
  })

  it('clamps out-of-range values', () => {
    expect(clampPresentSettings({ fontSize: 9, lineWidth: 200, shadow: 140 })).toEqual({
      fontSize: FONT_MIN,
      lineWidth: 94,
      shadow: 100,
      fontId: 'helvetica',
    })
  })

  it('persists and reloads settings including typeface', () => {
    savePresentSettings({ fontSize: 52, lineWidth: 72, shadow: 20, fontId: 'playfair' })
    expect(loadPresentSettings()).toEqual({ fontSize: 52, lineWidth: 72, shadow: 20, fontId: 'playfair' })
  })

  it('falls back to Helvetica Neue for an unknown stored typeface', () => {
    memory.set(
      'setflow.presentSettings',
      JSON.stringify({ fontSize: 52, lineWidth: 72, shadow: 20, fontId: 'comic-sans' }),
    )
    expect(loadPresentSettings().fontId).toBe('helvetica')
  })

  it('drops a stored overlay value from older settings', () => {
    memory.set(
      'setflow.presentSettings',
      JSON.stringify({ fontSize: 52, lineWidth: 72, overlay: 80, shadow: 20 }),
    )
    expect(loadPresentSettings()).toEqual({ fontSize: 52, lineWidth: 72, shadow: 20, fontId: 'helvetica' })
  })

  it('returns defaults when storage is empty or corrupt', () => {
    expect(loadPresentSettings()).toEqual(DEFAULT_PRESENT_SETTINGS)
    memory.set('setflow.presentSettings', '{not json')
    expect(loadPresentSettings()).toEqual(DEFAULT_PRESENT_SETTINGS)
  })

  it('shrinks font so a long line fits the four-line width', () => {
    expect(fittedFontSize(52, 400, 800)).toBe(52)
    expect(fittedFontSize(52, 1040, 800)).toBe(48)
    expect(fittedFontSize(52, 8000, 800)).toBe(FONT_MIN)
  })

  it('maps pixel size onto the saved small/medium/large preference', () => {
    expect(coarseFontSize(36)).toBe('small')
    expect(coarseFontSize(52)).toBe('medium')
    expect(coarseFontSize(68)).toBe('large')
  })

  it('builds a dark stacked text shadow from the slider', () => {
    expect(lyricTextShadow(0)).toBe('none')
    const mid = lyricTextShadow(60)
    expect(mid).toContain('rgba(0,0,0,0.968)')
    expect(mid).toContain('rgba(0,0,0,0.920)')
    expect(mid.split(',').length).toBeGreaterThanOrEqual(4)
    expect(lyricTextShadow(100)).toContain('rgba(0,0,0,1.000)')
  })

  it('offers several present-mode typefaces and falls back to Helvetica Neue Bold', () => {
    expect(PRESENT_FONTS.map((font) => font.id)).toEqual([
      'helvetica',
      'montserrat',
      'georgia',
      'inter',
      'playfair',
      'garamond',
      'outfit',
    ])
    expect(findPresentFont('outfit').label).toBe('Outfit')
    expect(findPresentFont('missing').id).toBe('helvetica')
    expect(presentFontFamily('playfair')).toContain('Playfair Display')
    expect(presentFontFamily('helvetica')).toContain('Helvetica Neue')
    expect(presentFontFamily('helvetica')).toMatch(/Helvetica Neue.*Arial.*Inter/)
    expect(findPresentFont('helvetica').weight).toBe(700)
    expect(findPresentFont('helvetica').tracking).toBe('-0.02em')
    expect(findPresentFont('montserrat').weight).toBe(600)
  })
})
