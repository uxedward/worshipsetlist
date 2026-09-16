import { describe, expect, it } from 'vitest'
import { AUTH_SCHEMA_STATEMENTS } from './authSchema.ts'

describe('AUTH_SCHEMA_STATEMENTS', () => {
  it('creates the account tables idempotently', () => {
    expect(AUTH_SCHEMA_STATEMENTS.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS "User"'))).toBe(true)
    expect(AUTH_SCHEMA_STATEMENTS.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS "AuthSetting"'))).toBe(true)
    expect(
      AUTH_SCHEMA_STATEMENTS.some((sql) => sql.includes('CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key"')),
    ).toBe(true)
  })

  it('migrates Preference to one row per account', () => {
    expect(
      AUTH_SCHEMA_STATEMENTS.some((sql) => sql.includes('ADD COLUMN IF NOT EXISTS "userId"')),
    ).toBe(true)
    expect(
      AUTH_SCHEMA_STATEMENTS.some((sql) => sql.includes('CREATE UNIQUE INDEX IF NOT EXISTS "Preference_userId_key"')),
    ).toBe(true)
    // The old table declared `id` with no default, so per-user rows need one.
    expect(AUTH_SCHEMA_STATEMENTS.some((sql) => sql.includes('CREATE SEQUENCE IF NOT EXISTS'))).toBe(true)
    expect(AUTH_SCHEMA_STATEMENTS.some((sql) => sql.includes('SET DEFAULT nextval'))).toBe(true)
  })

  it('avoids pgbouncer-unsafe DO blocks, like the rest of the bootstrap SQL', () => {
    expect(AUTH_SCHEMA_STATEMENTS.every((sql) => !/\bDO\s+\$\$/i.test(sql))).toBe(true)
  })

  it('does not ALTER ENABLE RLS on the request path — that hangs pgbouncer', () => {
    expect(AUTH_SCHEMA_STATEMENTS.every((sql) => !/ENABLE ROW LEVEL SECURITY/i.test(sql))).toBe(true)
  })
})
