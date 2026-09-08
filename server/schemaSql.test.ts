import { describe, expect, it } from 'vitest'
import { SCHEMA_STATEMENTS } from './schemaSql.ts'

describe('SCHEMA_STATEMENTS', () => {
  it('uses IF NOT EXISTS and avoids pgbouncer-unsafe DO blocks', () => {
    expect(SCHEMA_STATEMENTS.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS "Song"'))).toBe(true)
    expect(SCHEMA_STATEMENTS.every((sql) => !/\bDO\s+\$\$/i.test(sql))).toBe(true)
  })
})
