import { describe, expect, it } from 'vitest'
import { setlistWithSongMeta, songWithChart } from './songInclude.ts'

describe('song includes', () => {
  it('keeps chord charts off setlist and library lists', () => {
    expect(setlistWithSongMeta.songs.include).toEqual({ song: true })
    expect(songWithChart.sections.include.lines).toEqual({ orderBy: { order: 'asc' } })
  })
})
