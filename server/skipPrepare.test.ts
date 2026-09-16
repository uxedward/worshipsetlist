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

  it('skips library reads so boot, songs, and present charts are not blocked by schema restore', () => {
    expect(skipDatabasePrepare('GET', '/api/bootstrap')).toBe(true)
    expect(skipDatabasePrepare('GET', '/api/songs')).toBe(true)
    expect(skipDatabasePrepare('GET', '/api/songs/abc123')).toBe(true)
    expect(skipDatabasePrepare('GET', '/api/setlists')).toBe(true)
    expect(skipDatabasePrepare('GET', '/api/setlists/abc/songs')).toBe(true)
    expect(skipDatabasePrepare('GET', '/api/preferences')).toBe(true)
  })

  it('skips every auth route so sign-in and first-run setup are not blocked by schema restore', () => {
    expect(skipDatabasePrepare('GET', '/api/auth/state')).toBe(true)
    expect(skipDatabasePrepare('GET', '/api/auth/me')).toBe(true)
    expect(skipDatabasePrepare('GET', '/api/auth/reset/abc')).toBe(true)
    expect(skipDatabasePrepare('POST', '/api/auth/login')).toBe(true)
    expect(skipDatabasePrepare('POST', '/api/auth/logout')).toBe(true)
    expect(skipDatabasePrepare('POST', '/api/auth/setup')).toBe(true)
    expect(skipDatabasePrepare('POST', '/api/auth/users')).toBe(true)
  })

  it('still prepares song writes so a brand-new database can accept edits', () => {
    expect(skipDatabasePrepare('POST', '/api/songs')).toBe(false)
    expect(skipDatabasePrepare('PATCH', '/api/songs/abc123')).toBe(false)
    expect(skipDatabasePrepare('DELETE', '/api/songs/abc123')).toBe(false)
    expect(skipDatabasePrepare('PATCH', '/api/setlists/abc')).toBe(false)
  })
})

describe('needsDatabasePrepare', () => {
  it('detects a missing table so a video write can create schema and retry', () => {
    expect(needsDatabasePrepare(new Error('relation "BackgroundChunk" does not exist'))).toBe(true)
    expect(needsDatabasePrepare(new Error('relation "User" does not exist'))).toBe(true)
    expect(needsDatabasePrepare(new Error('That video chunk is out of range.'))).toBe(false)
  })
})
