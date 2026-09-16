import { describe, expect, it } from 'vitest'
import {
  RESET_TOKEN_TTL_MS,
  createResetToken,
  hashResetToken,
  requestOrigin,
  resetLinkFor,
  resetTokenProblem,
} from './passwordReset.ts'

describe('reset tokens', () => {
  it('never returns the same token twice', () => {
    expect(createResetToken().token).not.toBe(createResetToken().token)
  })

  it('stores only a hash that matches the issued token', () => {
    const { token, tokenHash } = createResetToken()
    expect(tokenHash).toBe(hashResetToken(token))
    expect(tokenHash).not.toContain(token)
  })

  it('expires a day out', () => {
    const { expiresAt } = createResetToken()
    const delta = expiresAt.getTime() - Date.now()
    expect(delta).toBeGreaterThan(RESET_TOKEN_TTL_MS - 5_000)
    expect(delta).toBeLessThanOrEqual(RESET_TOKEN_TTL_MS)
  })
})

describe('resetTokenProblem', () => {
  const future = new Date(Date.now() + 60_000)
  const past = new Date(Date.now() - 60_000)

  it('accepts a fresh unused token', () => {
    expect(resetTokenProblem({ expiresAt: future, usedAt: null })).toBeNull()
  })

  it('rejects an unknown token', () => {
    expect(resetTokenProblem(null)).toMatch(/not valid/)
  })

  it('rejects a token that was already spent', () => {
    expect(resetTokenProblem({ expiresAt: future, usedAt: new Date() })).toMatch(/already been used/)
  })

  it('rejects an expired token', () => {
    expect(resetTokenProblem({ expiresAt: past, usedAt: null })).toMatch(/expired/)
  })
})

describe('reset links', () => {
  it('builds a link the app can read on load', () => {
    expect(resetLinkFor('abc123', 'https://setflow.app')).toBe('https://setflow.app/?reset=abc123')
  })

  it('does not double up slashes', () => {
    expect(resetLinkFor('abc', 'https://setflow.app/')).toBe('https://setflow.app/?reset=abc')
  })

  it('escapes a token so the query stays parseable', () => {
    expect(resetLinkFor('a+b/c=', 'https://x.dev')).toBe('https://x.dev/?reset=a%2Bb%2Fc%3D')
  })

  it('derives the origin from proxy headers', () => {
    expect(requestOrigin({ 'x-forwarded-proto': 'https', 'x-forwarded-host': 'setflow.app' })).toBe(
      'https://setflow.app',
    )
    expect(requestOrigin({ host: 'localhost:3001' })).toBe('http://localhost:3001')
    expect(requestOrigin({})).toBe('')
  })
})
