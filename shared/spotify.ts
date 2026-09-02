export type SpotifyLinkKind = 'playlist' | 'album' | 'track'

export type SpotifyLink = {
  kind: SpotifyLinkKind
  id: string
}

export type SpotifyTrack = {
  title: string
  artist: string
  durationSeconds: number | null
}

export type SpotifyLookup = {
  kind: SpotifyLinkKind
  name: string
  tracks: SpotifyTrack[]
}

const ID = '[A-Za-z0-9]{22}'

export function parseSpotifyUrl(input: string): SpotifyLink | null {
  const raw = input.trim()
  if (!raw) return null

  const uri = raw.match(new RegExp(`^spotify:(playlist|album|track):(${ID})$`, 'i'))
  if (uri) {
    return { kind: uri[1].toLowerCase() as SpotifyLinkKind, id: uri[2] }
  }

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (!/(^|\.)spotify\.com$/i.test(url.hostname)) return null

  const match = url.pathname.match(new RegExp(`/(playlist|album|track)/(${ID})`, 'i'))
  if (!match) return null
  return { kind: match[1].toLowerCase() as SpotifyLinkKind, id: match[2] }
}

export function spotifyEmbedUrl(link: SpotifyLink): string {
  return `https://open.spotify.com/embed/${link.kind}/${link.id}`
}

export function tracksFromEmbedEntity(entity: Record<string, unknown>, kind: SpotifyLinkKind): SpotifyLookup {
  const name = str(entity.title) || str(entity.name) || 'Spotify import'
  if (kind === 'track') {
    const track = trackFromNode(entity)
    return { kind, name: track.title, tracks: track.title ? [track] : [] }
  }
  const list = Array.isArray(entity.trackList) ? entity.trackList : []
  const tracks = list
    .map((item) => (item && typeof item === 'object' ? trackFromNode(item as Record<string, unknown>) : null))
    .filter((t): t is SpotifyTrack => Boolean(t?.title && t.artist))
  return { kind, name, tracks }
}

function trackFromNode(node: Record<string, unknown>): SpotifyTrack {
  const artists = Array.isArray(node.artists)
    ? node.artists
        .map((a) => (a && typeof a === 'object' ? str((a as { name?: unknown }).name) : ''))
        .filter(Boolean)
        .join(', ')
    : ''
  return {
    title: str(node.title) || str(node.name),
    artist: str(node.subtitle) || artists || 'Unknown Artist',
    durationSeconds: durationSeconds(node.duration),
  }
}

function durationSeconds(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return value > 1000 ? Math.round(value / 1000) : Math.round(value)
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

export function entityFromEmbedHtml(html: string): Record<string, unknown> | null {
  const match = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[1]) as unknown
    const fromPath = nestedEntity(parsed)
    if (fromPath) return fromPath
    return findEntity(parsed, 0)
  } catch {
    return null
  }
}

function nestedEntity(parsed: unknown): Record<string, unknown> | null {
  if (!parsed || typeof parsed !== 'object') return null
  const entity = (parsed as { props?: { pageProps?: { state?: { data?: { entity?: unknown } } } } }).props
    ?.pageProps?.state?.data?.entity
  return asEntity(entity)
}

function findEntity(node: unknown, depth: number): Record<string, unknown> | null {
  if (depth > 12 || !node || typeof node !== 'object') return null
  const direct = asEntity(node)
  if (direct) return direct
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findEntity(item, depth + 1)
      if (found) return found
    }
    return null
  }
  for (const value of Object.values(node as Record<string, unknown>)) {
    const found = findEntity(value, depth + 1)
    if (found) return found
  }
  return null
}

function asEntity(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return null
  const rec = node as Record<string, unknown>
  if (Array.isArray(rec.trackList)) return rec
  if (typeof rec.title === 'string' && rec.title.trim() && (Array.isArray(rec.artists) || typeof rec.subtitle === 'string')) {
    return rec
  }
  return null
}
