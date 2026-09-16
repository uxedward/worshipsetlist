import { describe, expect, it } from 'vitest'
import { currentLibraryOwner, libraryStorageKey, setLibraryOwner } from './libraryOwner.ts'

describe('libraryOwner', () => {
  it('namespaces storage keys per account', () => {
    setLibraryOwner(null)
    expect(libraryStorageKey('setflow.persist.v2')).toBe('setflow.persist.v2')
    setLibraryOwner('user-2')
    expect(currentLibraryOwner()).toBe('user-2')
    expect(libraryStorageKey('setflow.persist.v2')).toBe('setflow.persist.v2.user-2')
    setLibraryOwner(null)
  })
})
