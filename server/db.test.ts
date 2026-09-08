import { describe, expect, it } from 'vitest'
import { isPoolTimeout } from './db.ts'

describe('isPoolTimeout', () => {
  it('detects Prisma connection pool timeouts', () => {
    expect(
      isPoolTimeout(
        new Error('Timed out fetching a new connection from the connection pool. (Current connection pool timeout: 10, connection limit: 1)'),
      ),
    ).toBe(true)
    expect(isPoolTimeout(new Error('Song not found'))).toBe(false)
  })
})
