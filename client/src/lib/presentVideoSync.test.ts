import { describe, expect, it } from 'vitest'
import { pendingAsBackgrounds } from './presentVideoSync.ts'

describe('present video sync', () => {
  it('shows unfinished copies on other browsers without making them playable', () => {
    const pending = pendingAsBackgrounds([
      { id: 'custom-a', label: 'Cool Rainbow Pulse 4k', sizeBytes: 0, poster: 'data:image/jpeg;base64,xx' },
    ])
    expect(pending[0]).toMatchObject({
      id: 'custom-a',
      label: 'Cool Rainbow Pulse 4k',
      pending: true,
      custom: true,
      poster: 'data:image/jpeg;base64,xx',
    })
    expect(pending[0]?.src).toBeUndefined()
  })
})
