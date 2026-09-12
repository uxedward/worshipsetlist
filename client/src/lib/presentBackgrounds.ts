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
}

export const DEFAULT_PRESENT_BACKGROUND = 'horizon'
const STORAGE_KEY = 'setflow.presentBackground'
const ASSET_V = '4'

// Live clips are muted looping 4K camera footage. Stills are 4K frames.
// Sources and licenses: client/public/backgrounds/CREDITS.txt
export const PRESENT_BACKGROUNDS: PresentBackground[] = [
  { id: 'horizon', label: 'Horizon', kind: 'gradient', group: 'still', fill: 'var(--present-horizon)' },
  { id: 'afterglow', label: 'Afterglow', kind: 'gradient', group: 'still', fill: 'var(--present-afterglow)' },
  { id: 'ember', label: 'Ember', kind: 'gradient', group: 'still', fill: 'var(--present-ember)' },
  { id: 'canyon', label: 'Canyon', kind: 'gradient', group: 'still', fill: 'var(--present-canyon)' },
  { id: 'violet', label: 'Violet hour', kind: 'gradient', group: 'still', fill: 'var(--present-violet)' },
  { id: 'blush', label: 'Blush', kind: 'gradient', group: 'still', fill: 'var(--present-blush)' },
  { id: 'dusk', label: 'Dusk', kind: 'gradient', group: 'still', fill: 'var(--present-dusk)' },
  { id: 'ocean', label: 'Ocean', kind: 'photo', group: 'still', src: `/backgrounds/ocean.jpg?v=${ASSET_V}` },
  { id: 'mountains', label: 'Mountains', kind: 'photo', group: 'still', src: `/backgrounds/mountains.jpg?v=${ASSET_V}` },
  { id: 'forest', label: 'Forest', kind: 'photo', group: 'still', src: `/backgrounds/forest.jpg?v=${ASSET_V}` },
  { id: 'lake', label: 'Lake', kind: 'photo', group: 'still', src: `/backgrounds/lake.jpg?v=${ASSET_V}` },
  { id: 'sky', label: 'Sunset sky', kind: 'photo', group: 'still', src: `/backgrounds/sky.jpg?v=${ASSET_V}` },
  {
    id: 'ocean-live',
    label: 'Ocean live',
    kind: 'video',
    group: 'motion',
    src: `/backgrounds/ocean.mp4?v=${ASSET_V}`,
    src4k: `/backgrounds/ocean-4k.mp4?v=${ASSET_V}`,
    poster: `/backgrounds/ocean.jpg?v=${ASSET_V}`,
  },
  {
    id: 'mountains-live',
    label: 'Mountains live',
    kind: 'video',
    group: 'motion',
    src: `/backgrounds/mountains.mp4?v=${ASSET_V}`,
    src4k: `/backgrounds/mountains-4k.mp4?v=${ASSET_V}`,
    poster: `/backgrounds/mountains.jpg?v=${ASSET_V}`,
  },
  {
    id: 'forest-live',
    label: 'Forest live',
    kind: 'video',
    group: 'motion',
    src: `/backgrounds/forest.mp4?v=${ASSET_V}`,
    src4k: `/backgrounds/forest-4k.mp4?v=${ASSET_V}`,
    poster: `/backgrounds/forest.jpg?v=${ASSET_V}`,
  },
  {
    id: 'lake-live',
    label: 'Lake live',
    kind: 'video',
    group: 'motion',
    src: `/backgrounds/lake.mp4?v=${ASSET_V}`,
    src4k: `/backgrounds/lake-4k.mp4?v=${ASSET_V}`,
    poster: `/backgrounds/lake.jpg?v=${ASSET_V}`,
  },
]

export function findPresentBackground(id: string | null | undefined): PresentBackground {
  return PRESENT_BACKGROUNDS.find((bg) => bg.id === id) ?? PRESENT_BACKGROUNDS[0]
}

export function presentBackgroundFill(background: PresentBackground): string {
  return background.fill ?? 'var(--present-dusk)'
}

/** Retina / projector canvases get the 4K file; phones keep the 1080p loop. */
export function pickPresentVideoSrc(
  background: PresentBackground,
  viewport: { width: number; height: number; dpr: number } = currentViewport(),
): string | undefined {
  if (background.kind !== 'video') return background.src
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
    if (stored && PRESENT_BACKGROUNDS.some((bg) => bg.id === stored)) return stored
  } catch {
    /* ignore */
  }
  return DEFAULT_PRESENT_BACKGROUND
}

export function savePresentBackgroundId(id: string) {
  if (typeof localStorage === 'undefined') return
  if (!PRESENT_BACKGROUNDS.some((bg) => bg.id === id)) return
  localStorage.setItem(STORAGE_KEY, id)
}
