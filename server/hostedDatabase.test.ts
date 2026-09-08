import { describe, expect, it } from 'vitest'
import {
  applyPrismaPoolParams,
  databaseVendor,
  resolveDatabaseUrl,
} from './hostedDatabase.ts'

describe('resolveDatabaseUrl', () => {
  it('uses an explicit Postgres DATABASE_URL', () => {
    expect(
      resolveDatabaseUrl({
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/setflow',
      }),
    ).toBe('postgresql://user:pass@localhost:5432/setflow')
  })

  it('prefers a Vercel Supabase URL over a paused Prisma-hosted DATABASE_URL', () => {
    expect(
      resolveDatabaseUrl({
        DATABASE_URL: 'postgres://u:p@db.prisma.io:5432/postgres?sslmode=require',
        POSTGRES_PRISMA_URL:
          'postgres://u:p@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true',
      }),
    ).toContain('pooler.supabase.com')
  })

  it('uses POSTGRES_URL when DATABASE_URL is missing', () => {
    expect(
      resolveDatabaseUrl({
        POSTGRES_URL: 'postgresql://user:pass@db.example.supabase.co:5432/postgres',
      }),
    ).toContain('supabase.co')
  })

  it('falls back to the hosted production database', () => {
    const url = resolveDatabaseUrl({ DATABASE_URL: 'file:./setflow.db' })
    expect(url.startsWith('postgres://') || url.startsWith('postgresql://')).toBe(true)
    expect(url).toContain('db.prisma.io')
  })
})

describe('applyPrismaPoolParams', () => {
  it('caps each Vercel instance to one database connection', () => {
    const url = applyPrismaPoolParams('postgresql://user:pass@localhost:5432/setflow?sslmode=require', {
      VERCEL: '1',
    })
    expect(url).toContain('connection_limit=1')
    expect(url).toContain('pool_timeout=20')
    expect(url).toContain('connect_timeout=10')
    expect(url).toContain('sslmode=require')
  })

  it('uses a small local pool', () => {
    const url = applyPrismaPoolParams('postgresql://user:pass@localhost:5432/setflow', {})
    expect(url).toContain('connection_limit=3')
  })

  it('enables pgbouncer on the Supabase transaction pooler', () => {
    const url = applyPrismaPoolParams(
      'postgres://u:p@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
      { VERCEL: '1' },
    )
    expect(url).toContain('pgbouncer=true')
    expect(url).toContain('sslmode=require')
    expect(databaseVendor(url)).toBe('supabase')
  })
})
