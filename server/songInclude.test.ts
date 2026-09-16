import { describe, expect, it } from 'vitest'
import { setlistWithSongCharts, setlistWithSongMeta, songWithChart } from './songInclude.ts'

describe('song includes', () => {
  it('keeps chord charts off setlist and library lists', () => {
    expect(setlistWithSongMeta.songs.include).toEqual({ song: true })
    expect(songWithChart.sections.include.lines).toEqual({ orderBy: { order: 'asc' } })
  })

  it('loads setlist charts only when Present needs the active set', () => {
    expect(setlistWithSongCharts.songs.include).toEqual({ song: { include: songWithChart } })
  })
})
