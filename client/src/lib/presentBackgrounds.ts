export type PresentBackgroundKind = 'gradient' | 'photo' | 'video'

export type PresentBackground = {
  id: string
  label: string
  kind: PresentBackgroundKind
  group: 'still' | 'motion'
  src?: string
  src4k?: string
  poster?: string
  /** CSS fill for gradient stills, e.g. var(--present-horizon). */
  fill?: string
  custom?: boolean
}

export const DEFAULT_PRESENT_BACKGROUND = 'horizon'
const STORAGE_KEY = 'setflow.presentBackground'
const ASSET_V = '4'
const RETIRED_BACKGROUND_IDS = new Set([
  'ocean',
  'mountains',
  'forest',
  'lake',
  'sky',
  'mountains-live',
  'forest-live',
  'lake-live',
])

// Ocean live is muted looping 4K camera footage.
// Source and license: client/public/backgrounds/CREDITS.txt
export const PRESENT_BACKGROUNDS: PresentBackground[] = [
  { id: 'horizon', label: 'Horizon', kind: 'gradient', group: 'still', fill: 'var(--present-horizon)' },
  { id: 'afterglow', label: 'Afterglow', kind: 'gradient', group: 'still', fill: 'var(--present-afterglow)' },
  { id: 'ember', label: 'Ember', kind: 'gradient', group: 'still', fill: 'var(--present-ember)' },
  { id: 'canyon', label: 'Canyon', kind: 'gradient', group: 'still', fill: 'var(--present-canyon)' },
  { id: 'violet', label: 'Violet hour', kind: 'gradient', group: 'still', fill: 'var(--present-violet)' },
  { id: 'blush', label: 'Blush', kind: 'gradient', group: 'still', fill: 'var(--present-blush)' },
  { id: 'dusk', label: 'Dusk', kind: 'gradient', group: 'still', fill: 'var(--present-dusk)' },
  {
    id: 'ocean-live',
    label: 'Ocean live',
    kind: 'video',
    group: 'motion',
    src: `/backgrounds/ocean.mp4?v=${ASSET_V}`,
    src4k: `/backgrounds/ocean-4k.mp4?v=${ASSET_V}`,
    poster: `/backgrounds/ocean.jpg?v=${ASSET_V}`,
  },
]

export function findPresentBackground(
  id: string | null | undefined,
  extras: PresentBackground[] = [],
): PresentBackground {
  if (id && RETIRED_BACKGROUND_IDS.has(id)) {
    return PRESENT_BACKGROUNDS.find((bg) => bg.id === 'ocean-live') ?? PRESENT_BACKGROUNDS[0]
  }
  return extras.find((bg) => bg.id === id) ?? PRESENT_BACKGROUNDS.find((bg) => bg.id === id) ?? PRESENT_BACKGROUNDS[0]
}

export function presentBackgroundFill(background: PresentBackground): string {
  return background.fill ?? 'var(--present-dusk)'
}

/** Retina / projector canvases get the 4K file; phones keep the 1080p loop. Uploaded clips stay at full resolution. */
export function pickPresentVideoSrc(
  background: PresentBackground,
  viewport: { width: number; height: number; dpr: number } = currentViewport(),
): string | undefined {
  if (background.kind !== 'video') return background.src
  if (background.custom) return background.src4k ?? background.src
  const longEdge = Math.max(viewport.width, viewport.height) * Math.min(viewport.dpr, 2)
  const wants4k = Boolean(background.src4k) && longEdge >= 1800
  return wants4k ? background.src4k : background.src
}

export function currentViewport() {
  if (typeof window === 'undefined') return { width: 1280, height: 720, dpr: 1 }
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
  }
}

export function loadPresentBackgroundId(): string {
  if (typeof localStorage === 'undefined') return DEFAULT_PRESENT_BACKGROUND
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return stored
  } catch {
    /* ignore */
  }
  return DEFAULT_PRESENT_BACKGROUND
}

export function savePresentBackgroundId(id: string) {
  if (typeof localStorage === 'undefined' || !id) return
  localStorage.setItem(STORAGE_KEY, id)
}
