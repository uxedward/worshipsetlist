import { describe, expect, it } from 'vitest'
import type { Router } from 'express'
import { songsRouter } from './routes/songs.ts'
import { setlistsRouter } from './routes/setlists.ts'
import { backgroundsRouter } from './routes/backgrounds.ts'
import { preferencesRouter } from './routes/preferences.ts'

type Layer = {
  name?: string
  handle?: { name?: string }
  route?: { path: string; stack: Array<{ name?: string; method?: string }>; methods: Record<string, boolean> }
}

/** Walks a router's stack so the matrix is checked against what is mounted. */
function guardsFor(router: Router, method: string, path: string): string[] {
  const stack = (router as unknown as { stack: Layer[] }).stack
  const routerLevel = stack
    .filter((layer) => !layer.route && layer.handle?.name)
    .map((layer) => layer.handle!.name!)
  const route = stack.find((layer) => layer.route?.path === path && layer.route.methods[method])
  if (!route?.route) throw new Error(`No ${method.toUpperCase()} ${path} route is mounted`)
  return [...routerLevel, ...route.route.stack.map((entry) => entry.name ?? '')]
}

const ADMIN_ONLY: Array<[string, Router, string, string]> = [
  ['delete a song', songsRouter, 'delete', '/:id'],
  ['delete a setlist', setlistsRouter, 'delete', '/:id'],
  ['add a background', backgroundsRouter, 'post', '/'],
  ['mint a background upload URL', backgroundsRouter, 'post', '/upload'],
  ['delete a background', backgroundsRouter, 'delete', '/:id'],
]

const ANY_MEMBER: Array<[string, Router, string, string]> = [
  ['add a song', songsRouter, 'post', '/'],
  ['edit a song', songsRouter, 'patch', '/:id'],
  ['bulk import songs', songsRouter, 'post', '/bulk-import'],
  ['import from Spotify', songsRouter, 'post', '/spotify-lookup'],
  ['sync offline songs', songsRouter, 'post', '/sync-local'],
  ['read the library', songsRouter, 'get', '/'],
  ['create a setlist', setlistsRouter, 'post', '/'],
  ['rename a setlist', setlistsRouter, 'patch', '/:id'],
  ['duplicate a setlist', setlistsRouter, 'post', '/:id/duplicate'],
  ['add a song to a setlist', setlistsRouter, 'post', '/:id/songs'],
  ['transpose a setlist song', setlistsRouter, 'patch', '/:id/songs/:ssId'],
  ['drop a song from a setlist', setlistsRouter, 'delete', '/:id/songs/:ssId'],
  ['reorder a setlist', setlistsRouter, 'put', '/:id/reorder'],
  ['reorder setlists', setlistsRouter, 'put', '/reorder'],
  ['list backgrounds for Present mode', backgroundsRouter, 'get', '/'],
  ['stream a background', backgroundsRouter, 'get', '/media/:id'],
]

describe('admin-only routes', () => {
  it.each(ADMIN_ONLY)('only an admin can %s', (_label, router, method, path) => {
    expect(guardsFor(router, method, path)).toContain('requireAdmin')
  })
})

describe('routes open to any signed-in member', () => {
  it.each(ANY_MEMBER)('any member can %s', (_label, router, method, path) => {
    const guards = guardsFor(router, method, path)
    expect(guards).toContain('requireAuth')
    expect(guards).not.toContain('requireAdmin')
  })
})

describe('no route is left unauthenticated', () => {
  it.each([
    ['songs', songsRouter],
    ['setlists', setlistsRouter],
    ['backgrounds', backgroundsRouter],
    ['preferences', preferencesRouter],
  ])('%s requires a session', (_name, router) => {
    const stack = (router as unknown as { stack: Layer[] }).stack
    const routerLevel = stack.filter((layer) => !layer.route).map((layer) => layer.handle?.name)
    expect(routerLevel).toContain('requireAuth')
  })
})
