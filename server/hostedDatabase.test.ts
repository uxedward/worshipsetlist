import { describe, expect, it } from 'vitest'
import { resolveDatabaseUrl } from './hostedDatabase.ts'

describe('resolveDatabaseUrl', () => {
  it('uses an explicit Postgres DATABASE_URL', () => {
    expect(
      resolveDatabaseUrl({
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/setflow',
      }),
    ).toBe('postgresql://user:pass@localhost:5432/setflow')
  })

  it('falls back to the hosted production database', () => {
    const url = resolveDatabaseUrl({ DATABASE_URL: 'file:./setflow.db' })
    expect(url.startsWith('postgres://') || url.startsWith('postgresql://')).toBe(true)
    expect(url).toContain('db.prisma.io')
  })
})
