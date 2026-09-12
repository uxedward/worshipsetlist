import type { PresentationFontSize } from '@shared/types.ts'

export type PresentFontId = 'helvetica' | 'montserrat' | 'georgia' | 'inter' | 'playfair' | 'garamond' | 'outfit'

export type PresentFont = {
  id: PresentFontId
  label: string
  family: string
  weight: 400 | 500 | 600 | 700
  tracking?: string
}

export const PRESENT_FONTS: PresentFont[] = [
  {
    id: 'helvetica',
    label: 'Helvetica Neue',
    family: '"Helvetica Neue", Arial, Inter, sans-serif',
    weight: 700,
    tracking: '-0.02em',
  },
  { id: 'montserrat', label: 'Montserrat', family: 'Montserrat, Inter, sans-serif', weight: 600, tracking: '-0.02em' },
  { id: 'georgia', label: 'Georgia', family: 'Georgia, "Times New Roman", Times, serif', weight: 400 },
  { id: 'inter', label: 'Inter', family: 'Inter, system-ui, sans-serif', weight: 400 },
  { id: 'playfair', label: 'Playfair', family: '"Playfair Display", Georgia, serif', weight: 400 },
  { id: 'garamond', label: 'Garamond', family: '"EB Garamond", Georgia, serif', weight: 400 },
  { id: 'outfit', label: 'Outfit', family: 'Outfit, Inter, sans-serif', weight: 500 },
]

export const DEFAULT_PRESENT_FONT_ID: PresentFontId = 'helvetica'
export const PRESENT_FONT = PRESENT_FONTS[0].family

export type PresentStrokeId = 'off' | 'black' | 'white' | 'navy' | 'sky'

export type PresentStroke = {
  id: PresentStrokeId
  label: string
  fill: string
}

export const PRESENT_STROKES: PresentStroke[] = [
  { id: 'off', label: 'None', fill: 'transparent' },
  { id: 'black', label: 'Black', fill: 'var(--present-stroke-black)' },
  { id: 'white', label: 'White', fill: 'var(--present-stroke-white)' },
  { id: 'navy', label: 'Navy', fill: 'var(--present-stroke-navy)' },
  { id: 'sky', label: 'Sky', fill: 'var(--present-stroke-sky)' },
]

export const DEFAULT_PRESENT_STROKE_ID: PresentStrokeId = 'black'

export type PresentSettings = {
  fontSize: number
  lineWidth: number
  shadow: number
  fontId: PresentFontId
  strokeId: PresentStrokeId
}

export const FONT_MIN = 48
export const FONT_MAX = 78
export const FONT_DEFAULT = 52
export const LINE_WIDTH_MIN = 58
export const LINE_WIDTH_MAX = 94
export const LINE_WIDTH_DEFAULT = 80
export const SHADOW_DEFAULT = 8

export const DEFAULT_PRESENT_SETTINGS: PresentSettings = {
  fontSize: FONT_DEFAULT,
  lineWidth: LINE_WIDTH_DEFAULT,
  shadow: SHADOW_DEFAULT,
  fontId: DEFAULT_PRESENT_FONT_ID,
  strokeId: DEFAULT_PRESENT_STROKE_ID,
}

const STORAGE_KEY = 'setflow.presentSettings'

export function findPresentFont(id: string | null | undefined): PresentFont {
  return PRESENT_FONTS.find((font) => font.id === id) ?? PRESENT_FONTS[0]
}

export function presentFontFamily(id: string | null | undefined): string {
  return findPresentFont(id).family
}

export function findPresentStroke(id: string | null | undefined): PresentStroke {
  return PRESENT_STROKES.find((stroke) => stroke.id === id) ?? PRESENT_STROKES[1]
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

export function clampPresentSettings(partial: Partial<PresentSettings> | null | undefined): PresentSettings {
  const src = partial ?? {}
  return {
    fontSize: clamp(src.fontSize ?? FONT_DEFAULT, FONT_MIN, FONT_MAX),
    lineWidth: clamp(src.lineWidth ?? LINE_WIDTH_DEFAULT, LINE_WIDTH_MIN, LINE_WIDTH_MAX),
    shadow: clamp(src.shadow ?? SHADOW_DEFAULT, 0, 100),
    fontId: findPresentFont(src.fontId).id,
    strokeId: findPresentStroke(src.strokeId).id,
  }
}

export function loadPresentSettings(): PresentSettings {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_PRESENT_SETTINGS }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PRESENT_SETTINGS }
    return clampPresentSettings(JSON.parse(raw) as Partial<PresentSettings>)
  } catch {
    return { ...DEFAULT_PRESENT_SETTINGS }
  }
}

export function savePresentSettings(settings: PresentSettings) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clampPresentSettings(settings)))
}

export function coarseFontSize(px: number): PresentationFontSize {
  if (px <= 42) return 'small'
  if (px <= 60) return 'medium'
  return 'large'
}

export function fittedFontSize(
  preferred: number,
  longestLineWidth: number,
  containerWidth: number,
  minSize = FONT_MIN,
): number {
  const max = clamp(preferred, minSize, FONT_MAX)
  if (containerWidth <= 1 || longestLineWidth <= 1) return max
  if (longestLineWidth <= containerWidth) return max
  return Math.max(minSize, Math.floor(max * (containerWidth / longestLineWidth)))
}

export function lyricTextShadow(shadow: number, strokeId: PresentStrokeId = DEFAULT_PRESENT_STROKE_ID): string {
  const t = clamp(shadow, 0, 100) / 100
  if (t <= 0) return 'none'
  const stroke = findPresentStroke(strokeId)
  const outline = (1 + t * 2).toFixed(1)
  const y = (2 + t * 3).toFixed(1)
  const blur = (3 + t * 10).toFixed(1)
  const glow = (4 + t * 12).toFixed(1)
  const aDrop = (0.45 + t * 0.35).toFixed(3)
  const aGlow = (0.35 + t * 0.3).toFixed(3)
  const parts: string[] = []
  if (stroke.id !== 'off') {
    const color = stroke.fill
    parts.push(
      `-${outline}px 0 0 ${color}`,
      `${outline}px 0 0 ${color}`,
      `0 ${outline}px 0 ${color}`,
      `0 -${outline}px 0 ${color}`,
      `-${outline}px -${outline}px 0 ${color}`,
      `${outline}px -${outline}px 0 ${color}`,
      `-${outline}px ${outline}px 0 ${color}`,
      `${outline}px ${outline}px 0 ${color}`,
    )
  }
  parts.push(`0 ${y}px ${blur}px rgba(0,0,0,${aDrop})`, `0 0 ${glow}px rgba(0,0,0,${aGlow})`)
  return parts.join(', ')
}
