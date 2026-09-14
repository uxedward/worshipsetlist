import { describe, expect, it } from 'vitest'
import { needsDatabasePrepare, skipDatabasePrepare } from './skipPrepare.ts'

describe('skipDatabasePrepare', () => {
  it('skips health and background routes so video list/writes do not wait on schema restore', () => {
    expect(skipDatabasePrepare('GET', '/api/health')).toBe(true)
    expect(skipDatabasePrepare('GET', '/api/backgrounds')).toBe(true)
    expect(skipDatabasePrepare('GET', '/api/backgrounds/media/custom-abc')).toBe(true)
    expect(skipDatabasePrepare('POST', '/api/backgrounds')).toBe(true)
    expect(skipDatabasePrepare('DELETE', '/api/backgrounds/custom-abc')).toBe(true)
  })

  it('still prepares song and bootstrap reads', () => {
    expect(skipDatabasePrepare('GET', '/api/songs')).toBe(false)
    expect(skipDatabasePrepare('GET', '/api/bootstrap')).toBe(false)
    expect(skipDatabasePrepare('PATCH', '/api/songs/abc123')).toBe(false)
  })
})

describe('needsDatabasePrepare', () => {
  it('detects a missing table so a video write can create schema and retry', () => {
    expect(needsDatabasePrepare(new Error('relation "BackgroundChunk" does not exist'))).toBe(true)
    expect(needsDatabasePrepare(new Error('That video chunk is out of range.'))).toBe(false)
  })
})
