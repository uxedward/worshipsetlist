let speak: ((message: string) => void) | null = null

export function setLiveAnnouncer(fn: ((message: string) => void) | null) {
  speak = fn
}

export function announce(message: string) {
  speak?.(message)
}
