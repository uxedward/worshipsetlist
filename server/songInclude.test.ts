import { describe, expect, it } from 'vitest'
import { setlistWithSongCharts, setlistWithSongMeta, songWithChart } from './songInclude.ts'

describe('song includes', () => {
  it('keeps chord charts off setlist and library lists', () => {
    expect(setlistWithSongMeta.songs.include).toEqual({ song: true })
    expect(songWithChart.sections.include.lines).toEqual({ orderBy: { order: 'asc' } })
  })

  it('loads setlist charts during bootstrap so Present does not wait on a second query', () => {
    expect(setlistWithSongCharts.songs.include).toEqual({ song: { include: songWithChart } })
  })
})
