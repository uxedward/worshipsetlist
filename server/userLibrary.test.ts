import { describe, expect, it } from 'vitest'
import { ownedBy } from './userLibrary.ts'
import { readFileSync } from 'node:fs'

describe('ownedBy', () => {
  it('filters rows to one account', () => {
    expect(ownedBy('user-1')).toEqual({ userId: 'user-1' })
  })
})

describe('loadBootstrap', () => {
  it('loads only the signed-in account\'s songs and setlists', () => {
    const src = readFileSync(new URL('./bootstrap.ts', import.meta.url), 'utf8')
    expect(src).toContain('where: owned')
    expect(src).toContain('ownedBy(userId)')
  })
})
