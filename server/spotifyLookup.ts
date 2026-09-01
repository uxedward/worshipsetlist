import {
  parseSpotifyUrl,
  spotifyEmbedUrl,
  tracksFromEmbedEntity,
  entityFromEmbedHtml,
  type SpotifyLink,
  type SpotifyLookup,
} from '../shared/spotify.ts'

const UA = 'SetflowWorshipApp/1.0 (https://github.com/uxedward/worshipsetlist; playlist-import)'
const RETRY_DELAYS_MS = [0, 500, 1500]

type LookupError = Error & { status?: number; retryable?: boolean }

export async function lookupSpotify(url: string): Promise<SpotifyLookup> {
  const link = parseSpotifyUrl(url)
  if (!link) {
    throw Object.assign(new Error('Paste a Spotify playlist, album, or song link.'), { status: 400 })
  }

  let lastError: LookupError | null = null
  for (const delay of RETRY_DELAYS_MS) {
    if (delay) await sleep(delay)
    try {
      const html = await fetchEmbedHtml(spotifyEmbedUrl(link))
      const entity = entityFromEmbedHtml(html)
      if (!entity) {
        lastError = fail('That Spotify page did not include a track list.', 422, true)
        continue
      }
      const lookup = tracksFromEmbedEntity(entity, link.kind)
      if (lookup.tracks.length === 0) {
        lastError = fail('No songs were found on that Spotify link.', 422, true)
        continue
      }
      return lookup
    } catch (err) {
      lastError = asLookupError(err)
      if (!lastError.retryable) throw lastError
    }
  }

  if (link.kind === 'track') {
    const fallback = await lookupTrackOembed(link)
    if (fallback) return fallback
  }

  throw lastError ?? fail('Could not read that Spotify link.', 502, false)
}

async function fetchEmbedHtml(url: string): Promise<string> {
  let res: Response
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: AbortSignal.timeout(12_000),
    })
  } catch {
    throw fail('Could not read that Spotify link.', 502, true)
  }
  if (!res.ok) {
    const retryable = res.status >= 500 || res.status === 429
    throw fail('Could not read that Spotify link.', retryable ? 502 : 422, retryable)
  }
  return res.text()
}

async function lookupTrackOembed(link: SpotifyLink): Promise<SpotifyLookup | null> {
  try {
    const res = await fetch(`https://open.spotify.com/oembed?url=https://open.spotify.com/track/${link.id}`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { title?: unknown }
    const title = typeof data.title === 'string' ? data.title.replace(/\s+/g, ' ').trim() : ''
    if (!title) return null
    return {
      kind: 'track',
      name: title,
      tracks: [{ title, artist: 'Unknown Artist', durationSeconds: null }],
    }
  } catch {
    return null
  }
}

function fail(message: string, status: number, retryable: boolean): LookupError {
  return Object.assign(new Error(message), { status, retryable })
}

function asLookupError(err: unknown): LookupError {
  if (err instanceof Error) {
    const retryable = 'retryable' in err ? Boolean((err as LookupError).retryable) : true
    const status = 'status' in err ? Number((err as LookupError).status) : 502
    return Object.assign(err, { status: Number.isFinite(status) ? status : 502, retryable })
  }
  return fail('Could not read that Spotify link.', 502, true)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
