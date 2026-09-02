import { describe, expect, it } from 'vitest'
import { parseSpotifyUrl, tracksFromEmbedEntity, entityFromEmbedHtml } from './spotify.ts'
import { sameSongIdentity, songInputFromSpotifyTrack } from './spotifyImport.ts'

describe('parseSpotifyUrl', () => {
  it('reads playlist, album, and track links', () => {
    expect(parseSpotifyUrl('https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd?si=abc')).toEqual({
      kind: 'playlist',
      id: '37i9dQZF1DX0XUsuxWHRQd',
    })
    expect(parseSpotifyUrl('https://open.spotify.com/intl-de/album/1DFixLWuPkv3KT3TnV35m3')).toEqual({
      kind: 'album',
      id: '1DFixLWuPkv3KT3TnV35m3',
    })
    expect(parseSpotifyUrl('spotify:track:4uLU6hMCjMI75M1A2tKUQC')).toEqual({
      kind: 'track',
      id: '4uLU6hMCjMI75M1A2tKUQC',
    })
  })

  it('rejects non-Spotify URLs', () => {
    expect(parseSpotifyUrl('https://example.com/playlist/37i9dQZF1DX0XUsuxWHRQd')).toBeNull()
    expect(parseSpotifyUrl('not a url')).toBeNull()
  })
})

describe('tracksFromEmbedEntity', () => {
  it('reads playlist trackList titles and artists', () => {
    const lookup = tracksFromEmbedEntity(
      {
        name: 'Sunday Worship',
        trackList: [
          { title: 'Oceans', subtitle: 'Hillsong UNITED', duration: 188000 },
          { title: 'Jireh', subtitle: 'Elevation Worship', duration: 321000 },
        ],
      },
      'playlist',
    )
    expect(lookup.name).toBe('Sunday Worship')
    expect(lookup.tracks).toEqual([
      { title: 'Oceans', artist: 'Hillsong UNITED', durationSeconds: 188 },
      { title: 'Jireh', artist: 'Elevation Worship', durationSeconds: 321 },
    ])
  })

  it('reads a single track entity', () => {
    const lookup = tracksFromEmbedEntity(
      {
        title: 'What A Beautiful Name',
        artists: [{ name: 'Hillsong Worship' }],
        duration: 238000,
      },
      'track',
    )
    expect(lookup.tracks).toEqual([
      { title: 'What A Beautiful Name', artist: 'Hillsong Worship', durationSeconds: 238 },
    ])
  })

  it('extracts the embed entity from Spotify HTML', () => {
    const html =
      '<html><script id="__NEXT_DATA__">{"props":{"pageProps":{"state":{"data":{"entity":{"title":"Jireh","artists":[{"name":"Elevation Worship"}],"duration":321000}}}}}}</script></html>'
    expect(entityFromEmbedHtml(html)).toEqual({
      title: 'Jireh',
      artists: [{ name: 'Elevation Worship' }],
      duration: 321000,
    })
  })

  it('finds the entity when the script attributes are reordered', () => {
    const html =
      '<html><script type="application/json" id="__NEXT_DATA__">{"props":{"pageProps":{"state":{"data":{"entity":{"title":"Oceans","subtitle":"Hillsong UNITED","trackList":[]}}}}}}</script></html>'
    expect(entityFromEmbedHtml(html)?.title).toBe('Oceans')
  })
})

describe('songInputFromSpotifyTrack', () => {
  it('builds a placeholder chart so the song can be saved', () => {
    const input = songInputFromSpotifyTrack({
      title: 'Oceans',
      artist: 'Hillsong UNITED',
      durationSeconds: 188,
    })
    expect(input.title).toBe('Oceans')
    expect(input.sections[0].lines[0].lyric).toBe('Add lyrics')
    expect(sameSongIdentity(input, { title: 'oceans', artist: 'hillsong united' })).toBe(true)
    expect(
      sameSongIdentity(
        { title: 'What A Beautiful Name', artist: 'Hillsong Worship' },
        { title: 'What A Beautiful Name', artist: 'Hillsong Worship, Brooke Ligertwood' },
      ),
    ).toBe(true)
    expect(
      sameSongIdentity(
        { title: 'What A Beautiful Name', artist: 'Hillsong Worship' },
        { title: 'What A Beautiful Name', artist: 'Elevation Worship' },
      ),
    ).toBe(false)
  })
})
