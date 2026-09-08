import { describe, expect, it } from 'vitest'
import { resolveSongKey } from '../shared/detectKey.ts'
import { loadRestoreSongs } from './restoreLibrary.ts'

describe('loadRestoreSongs', () => {
  it('has the three production library songs and detects keys from charts', () => {
    const songs = loadRestoreSongs()
    expect(songs.map((s) => s.title)).toEqual([
      'At the Altar',
      'Oceans (Where Feet May Fail)',
      'Bukti Kasih-Mu (NDC Worship)',
    ])
    const byTitle = Object.fromEntries(songs.map((s) => [s.title, s]))
    expect(resolveSongKey(byTitle['At the Altar'].key, byTitle['At the Altar'].sections)).toBe('D')
    expect(resolveSongKey(byTitle['Oceans (Where Feet May Fail)'].key, byTitle['Oceans (Where Feet May Fail)'].sections)).toBe('Bm')
    expect(
      resolveSongKey(
        byTitle['Bukti Kasih-Mu (NDC Worship)'].key,
        byTitle['Bukti Kasih-Mu (NDC Worship)'].sections,
      ),
    ).toBe('E')
  })
})
