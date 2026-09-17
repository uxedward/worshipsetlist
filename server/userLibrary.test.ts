import { describe, expect, it } from 'vitest'
import { ownedBy } from './userLibrary.ts'
import { readFileSync } from 'node:fs'

describe('ownedBy', () => {
  it('filters rows to one account', () => {
    expect(ownedBy('user-1')).toEqual({ userId: 'user-1' })
  })
})

describe('loadBootstrap', () => {
  it('loads only the signed-in account\'s setlists', () => {
    const src = readFileSync(new URL('./bootstrap.ts', import.meta.url), 'utf8')
    expect(src).toContain('where: owned')
    expect(src).toContain('ownedBy(userId)')
  })

  it('loads the shared song catalog for every signed-in account', () => {
    const src = readFileSync(new URL('./bootstrap.ts', import.meta.url), 'utf8')
    expect(src).toContain('The song catalog is the admin library')
    const songsCall = src.indexOf('prisma.song.findMany')
    expect(songsCall).toBeGreaterThan(-1)
    expect(src.slice(songsCall, songsCall + 400)).not.toMatch(/where:\s*owned/)
  })

  it('keeps chord charts off the setlist list and loads them for the active set only', () => {
    const src = readFileSync(new URL('./bootstrap.ts', import.meta.url), 'utf8')
    expect(src).toContain('include: setlistWithSongMeta')
    expect(src).toContain('include: setlistWithSongCharts')
    const listInclude = src.indexOf('include: setlistWithSongMeta')
    const chartInclude = src.indexOf('include: setlistWithSongCharts')
    const findMany = src.indexOf('prisma.setlist.findMany')
    const findFirst = src.indexOf('prisma.setlist.findFirst')
    expect(findMany).toBeGreaterThan(-1)
    expect(findFirst).toBeGreaterThan(findMany)
    expect(listInclude).toBeGreaterThan(findMany)
    expect(listInclude).toBeLessThan(findFirst)
    expect(chartInclude).toBeGreaterThan(findFirst)
  })
})

describe('songs routes', () => {
  it('lists songs without scoping them to the signed-in account', () => {
    const src = readFileSync(new URL('./routes/songs.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/ownedBy/)
  })
})
