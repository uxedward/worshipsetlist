import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('ensureSchema', () => {
  it('skips the DDL loop when the Song table already exists', () => {
    const src = readFileSync(new URL('./cloneLibrary.ts', import.meta.url), 'utf8')
    expect(src).toContain('if (await songTableExists()) return')
    expect(src).toContain('ensureRowLevelSecurity')
    expect(src).toContain('ENABLE ROW LEVEL SECURITY')
    expect(src).toContain("SET lock_timeout = '1000'")
  })
})
