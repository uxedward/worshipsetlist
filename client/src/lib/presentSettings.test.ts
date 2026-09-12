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
  PRESENT_STROKES,
  clampPresentSettings,
  coarseFontSize,
  findPresentFont,
  findPresentStroke,
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
      strokeId: 'black',
    })
  })

  it('persists and reloads settings including typeface', () => {
    savePresentSettings({ fontSize: 52, lineWidth: 72, shadow: 20, fontId: 'playfair', strokeId: 'black' })
    expect(loadPresentSettings()).toEqual({ fontSize: 52, lineWidth: 72, shadow: 20, fontId: 'playfair', strokeId: 'black' })
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
    expect(loadPresentSettings()).toEqual({ fontSize: 52, lineWidth: 72, shadow: 20, fontId: 'helvetica', strokeId: 'black' })
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

  it('builds a colored lyric stroke from the preset and weight slider', () => {
    expect(lyricTextShadow(0, 'black')).toBe('none')
    expect(lyricTextShadow(60, 'off')).not.toContain('var(--present-stroke-')
    expect(lyricTextShadow(60, 'off')).toContain('rgba(0,0,0,')
    const navy = lyricTextShadow(60, 'navy')
    expect(navy).toContain('var(--present-stroke-navy)')
    expect(navy.split(',').length).toBeGreaterThanOrEqual(8)
    expect(lyricTextShadow(40, 'white')).toContain('var(--present-stroke-white)')
    expect(lyricTextShadow(40, 'sky')).toContain('var(--present-stroke-sky)')
  })

  it('keeps stroke presets and falls back to black', () => {
    expect(PRESENT_STROKES.map((stroke) => stroke.id)).toEqual(['off', 'black', 'white', 'navy', 'sky'])
    expect(findPresentStroke('missing').id).toBe('black')
    memory.set(
      'setflow.presentSettings',
      JSON.stringify({ fontSize: 52, lineWidth: 72, shadow: 20, fontId: 'helvetica', strokeId: 'navy' }),
    )
    expect(loadPresentSettings().strokeId).toBe('navy')
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
