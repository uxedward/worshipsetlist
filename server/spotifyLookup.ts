import { parseSpotifyUrl, spotifyEmbedUrl, tracksFromEmbedEntity, entityFromEmbedHtml, type SpotifyLookup } from '../shared/spotify.ts'

const UA = 'SetflowWorshipApp/1.0 (https://github.com/uxedward/worshipsetlist; playlist-import)'

export async function lookupSpotify(url: string): Promise<SpotifyLookup> {
  const link = parseSpotifyUrl(url)
  if (!link) {
    throw Object.assign(new Error('Paste a Spotify playlist, album, or song link.'), { status: 400 })
  }

  const res = await fetch(spotifyEmbedUrl(link), {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    redirect: 'follow',
  })
  if (!res.ok) {
    throw Object.assign(new Error('Could not read that Spotify link.'), { status: 502 })
  }
  const html = await res.text()
  const entity = entityFromEmbedHtml(html)
  if (!entity) {
    throw Object.assign(new Error('That Spotify page did not include a track list.'), { status: 422 })
  }
  const lookup = tracksFromEmbedEntity(entity, link.kind)
  if (lookup.tracks.length === 0) {
    throw Object.assign(new Error('No songs were found on that Spotify link.'), { status: 422 })
  }
  return lookup
}
