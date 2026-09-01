export type PresentBackgroundKind = 'gradient' | 'photo' | 'video'

export type PresentBackground = {
  id: string
  label: string
  kind: PresentBackgroundKind
  group: 'still' | 'motion'
  src?: string
  poster?: string
}

export const DEFAULT_PRESENT_BACKGROUND = 'dusk'
const STORAGE_KEY = 'setflow.presentBackground'

// Live HD clips are real (muted, looping) nature camera footage, not Ken Burns stills.
// Sources and licenses: client/public/backgrounds/CREDITS.txt
export const PRESENT_BACKGROUNDS: PresentBackground[] = [
  { id: 'dusk', label: 'Warm dusk', kind: 'gradient', group: 'still' },
  { id: 'ocean', label: 'Ocean', kind: 'photo', group: 'still', src: '/backgrounds/ocean.jpg' },
  { id: 'mountains', label: 'Mountains', kind: 'photo', group: 'still', src: '/backgrounds/mountains.jpg' },
  { id: 'forest', label: 'Forest', kind: 'photo', group: 'still', src: '/backgrounds/forest.jpg' },
  { id: 'lake', label: 'Lake', kind: 'photo', group: 'still', src: '/backgrounds/lake.jpg' },
  { id: 'sky', label: 'Sunset sky', kind: 'photo', group: 'still', src: '/backgrounds/sky.jpg' },
  {
    id: 'ocean-live',
    label: 'Ocean live',
    kind: 'video',
    group: 'motion',
    src: '/backgrounds/ocean.webm?v=2',
    poster: '/backgrounds/ocean.jpg',
  },
  {
    id: 'mountains-live',
    label: 'Mountains live',
    kind: 'video',
    group: 'motion',
    src: '/backgrounds/mountains.webm?v=2',
    poster: '/backgrounds/mountains.jpg',
  },
  {
    id: 'forest-live',
    label: 'Forest live',
    kind: 'video',
    group: 'motion',
    src: '/backgrounds/forest.webm?v=2',
    poster: '/backgrounds/forest.jpg',
  },
  {
    id: 'lake-live',
    label: 'Lake live',
    kind: 'video',
    group: 'motion',
    src: '/backgrounds/lake.webm?v=2',
    poster: '/backgrounds/lake.jpg',
  },
]

export function findPresentBackground(id: string | null | undefined): PresentBackground {
  return PRESENT_BACKGROUNDS.find((bg) => bg.id === id) ?? PRESENT_BACKGROUNDS[0]
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
