import type { PresentationFontSize } from '@shared/types.ts'

export type PresentSettings = {
  fontSize: number
  lineWidth: number
  shadow: number
}

export const FONT_MIN = 22
export const FONT_MAX = 78
export const FONT_DEFAULT = 52
export const LINE_WIDTH_MIN = 58
export const LINE_WIDTH_MAX = 94
export const LINE_WIDTH_DEFAULT = 80
export const SHADOW_DEFAULT = 86

export const DEFAULT_PRESENT_SETTINGS: PresentSettings = {
  fontSize: FONT_DEFAULT,
  lineWidth: LINE_WIDTH_DEFAULT,
  shadow: SHADOW_DEFAULT,
}

const STORAGE_KEY = 'setflow.presentSettings'
export const PRESENT_FONT = 'Georgia, "Times New Roman", Times, serif'

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

export function lyricTextShadow(shadow: number): string {
  const t = clamp(shadow, 0, 100) / 100
  if (t <= 0) return 'none'
  const y = (2 + t * 6).toFixed(1)
  const tight = (2 + t * 8).toFixed(1)
  const blur = (12 + t * 32).toFixed(1)
  const glow = (16 + t * 40).toFixed(1)
  const aTight = (0.82 + t * 0.18).toFixed(3)
  const aDrop = (0.62 + t * 0.38).toFixed(3)
  const aGlow = (0.48 + t * 0.42).toFixed(3)
  return [
    `0 1px ${tight}px rgba(0,0,0,${aTight})`,
    `0 ${y}px ${blur}px rgba(0,0,0,${aDrop})`,
    `0 0 ${glow}px rgba(0,0,0,${aGlow})`,
  ].join(', ')
}
