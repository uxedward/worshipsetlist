import { describe, expect, it } from 'vitest'
import { SCHEMA_STATEMENTS, APP_TABLES, RLS_STATEMENTS, REVOKE_PUBLIC_ACCESS_STATEMENTS } from './schemaSql.ts'

describe('SCHEMA_STATEMENTS', () => {
  it('uses IF NOT EXISTS and avoids pgbouncer-unsafe DO blocks', () => {
    expect(SCHEMA_STATEMENTS.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS "Song"'))).toBe(true)
    expect(SCHEMA_STATEMENTS.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS "CustomBackground"'))).toBe(true)
    expect(SCHEMA_STATEMENTS.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS "BackgroundChunk"'))).toBe(true)
    expect(SCHEMA_STATEMENTS.some((sql) => sql.includes('ADD COLUMN IF NOT EXISTS "sizeBytes"'))).toBe(true)
    expect(SCHEMA_STATEMENTS.some((sql) => sql.includes('ENABLE ROW LEVEL SECURITY'))).toBe(true)
    expect(SCHEMA_STATEMENTS.every((sql) => !/\bDO\s+\$\$/i.test(sql))).toBe(true)
  })

  it('enables row level security so the Supabase Data API cannot read or write the library', () => {
    expect(APP_TABLES).toEqual([
      'User',
      'AuthSetting',
      'Song',
      'Section',
      'Line',
      'Setlist',
      'SetlistSong',
      'Preference',
      'CustomBackground',
      'BackgroundChunk',
    ])
    expect(RLS_STATEMENTS).toContain('ALTER TABLE "Song" ENABLE ROW LEVEL SECURITY')
    // Password hashes must never be reachable through the public Data API.
    expect(RLS_STATEMENTS).toContain('ALTER TABLE "User" ENABLE ROW LEVEL SECURITY')
    expect(REVOKE_PUBLIC_ACCESS_STATEMENTS).toContain('REVOKE ALL ON TABLE "User" FROM anon')
    expect(REVOKE_PUBLIC_ACCESS_STATEMENTS).toContain('REVOKE ALL ON TABLE "User" FROM authenticated')
    expect(RLS_STATEMENTS).toContain('ALTER TABLE "CustomBackground" ENABLE ROW LEVEL SECURITY')
    expect(REVOKE_PUBLIC_ACCESS_STATEMENTS).toContain('REVOKE ALL ON TABLE "Song" FROM anon')
    expect(REVOKE_PUBLIC_ACCESS_STATEMENTS).toContain('REVOKE ALL ON TABLE "Song" FROM authenticated')
    expect(RLS_STATEMENTS.every((sql) => !/\bDO\s+\$\$/i.test(sql))).toBe(true)
  })
})
