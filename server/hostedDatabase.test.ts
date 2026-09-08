import { describe, expect, it } from 'vitest'
import { applyPrismaPoolParams, resolveDatabaseUrl } from './hostedDatabase.ts'

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

describe('applyPrismaPoolParams', () => {
  it('caps Vercel to one connection', () => {
    const url = applyPrismaPoolParams('postgresql://user:pass@localhost:5432/setflow?sslmode=require', {
      VERCEL: '1',
    })
    expect(url).toContain('connection_limit=1')
    expect(url).toContain('sslmode=require')
  })

  it('uses a small local pool', () => {
    const url = applyPrismaPoolParams('postgresql://user:pass@localhost:5432/setflow', {})
    expect(url).toContain('connection_limit=3')
  })
})
