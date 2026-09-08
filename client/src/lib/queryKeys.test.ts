import { describe, expect, it } from 'vitest'
import { songsListQueryKey } from './queryKeys.ts'

describe('songsListQueryKey', () => {
  it('matches bootstrap and the default library filter', () => {
    expect(songsListQueryKey()).toEqual(songsListQueryKey({ sort: 'artist' }))
    expect(songsListQueryKey({ search: 'ocean' })).not.toEqual(songsListQueryKey())
  })
})
