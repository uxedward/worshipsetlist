import { describe, expect, it } from 'vitest'
import { isLibsqlUrl, remoteSqliteFromEnv } from './remoteDb.ts'

describe('remoteSqliteFromEnv', () => {
  it('reads Turso URL and token', () => {
    expect(
      remoteSqliteFromEnv({
        TURSO_DATABASE_URL: 'libsql://setflow-user.turso.io',
        TURSO_AUTH_TOKEN: 'secret',
      }),
    ).toEqual({ url: 'libsql://setflow-user.turso.io', authToken: 'secret' })
  })

  it('treats a libsql DATABASE_URL as remote', () => {
    expect(
      remoteSqliteFromEnv({
        DATABASE_URL: 'libsql://setflow-user.turso.io',
        TURSO_AUTH_TOKEN: 'secret',
      }),
    ).toEqual({ url: 'libsql://setflow-user.turso.io', authToken: 'secret' })
  })

  it('ignores a local SQLite file URL', () => {
    expect(isLibsqlUrl('file:./setflow.db')).toBe(false)
    expect(remoteSqliteFromEnv({ DATABASE_URL: 'file:./prisma/setflow.db' })).toBeNull()
  })
})
