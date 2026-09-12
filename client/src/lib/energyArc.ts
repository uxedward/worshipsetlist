/** Map a song BPM onto the five-stop energy arc (low → high). */
export function energyLevel(bpm: number | null | undefined): 1 | 2 | 3 | 4 | 5 {
  const n = typeof bpm === 'number' && Number.isFinite(bpm) ? bpm : 0
  if (n < 70) return 1
  if (n < 85) return 2
  if (n < 100) return 3
  if (n < 120) return 4
  return 5
}

export function energyToken(level: 1 | 2 | 3 | 4 | 5): string {
  return `var(--arc-${level})`
}
