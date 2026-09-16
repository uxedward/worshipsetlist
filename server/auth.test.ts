import { describe, expect, it } from 'vitest'
import {
  SESSION_COOKIE,
  createSessionToken,
  emailProblem,
  hashPassword,
  hasStrongSessionSecret,
  normalizeEmail,
  parseCookies,
  passwordProblem,
  readSessionToken,
  sessionCookieValue,
  verifyPassword,
  type SessionUser,
} from './auth.ts'

const env = { AUTH_SECRET: 'a-test-secret-that-is-long-enough' } as NodeJS.ProcessEnv
const admin: SessionUser = { id: 'u1', email: 'lead@church.org', name: 'Lead', role: 'admin' }

describe('passwords', () => {
  it('round-trips a password', () => {
    const stored = hashPassword('correct horse battery')
    expect(verifyPassword('correct horse battery', stored)).toBe(true)
    expect(verifyPassword('wrong horse battery', stored)).toBe(false)
  })

  it('salts each hash, so two identical passwords do not match as strings', () => {
    expect(hashPassword('same-password')).not.toBe(hashPassword('same-password'))
  })

  it('rejects a malformed stored hash instead of throwing', () => {
    expect(verifyPassword('anything', '')).toBe(false)
    expect(verifyPassword('anything', 'notscrypt$1$2$3$ab$cd')).toBe(false)
    expect(verifyPassword('anything', 'scrypt$16384$8$1$abcd')).toBe(false)
  })

  it('holds the line on length', () => {
    expect(passwordProblem('short')).toMatch(/8 characters/)
    expect(passwordProblem('')).toMatch(/required/)
    expect(passwordProblem('longenough')).toBeNull()
  })
})

describe('emails', () => {
  it('normalizes case and whitespace', () => {
    expect(normalizeEmail('  Lead@Church.ORG ')).toBe('lead@church.org')
  })

  it('flags an address that is not usable', () => {
    expect(emailProblem('nope')).toBeTruthy()
    expect(emailProblem('lead@church.org')).toBeNull()
  })
})

describe('session tokens', () => {
  it('round-trips a signed session', () => {
    const token = createSessionToken(admin, 1, env)
    expect(readSessionToken(token, 1, env)).toEqual(admin)
  })

  it('rejects a token signed with another secret', () => {
    const token = createSessionToken(admin, 1, env)
    const other = { AUTH_SECRET: 'a-different-secret-long-enough' } as NodeJS.ProcessEnv
    expect(readSessionToken(token, 1, other)).toBeNull()
  })

  it('rejects a tampered role', () => {
    const token = createSessionToken({ ...admin, role: 'user' }, 1, env)
    const [body, signature] = token.split('.')
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    payload.role = 'admin'
    const forged = `${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${signature}`
    expect(readSessionToken(forged, 1, env)).toBeNull()
  })

  it('rejects an expired token', () => {
    const token = createSessionToken(admin, 1, env, 0)
    expect(readSessionToken(token, 1, env, Date.now())).toBeNull()
  })

  it('rejects a token from an earlier session epoch', () => {
    const token = createSessionToken(admin, 3, env)
    expect(readSessionToken(token, 4, env)).toBeNull()
    expect(readSessionToken(token, 3, env)).toEqual(admin)
  })

  it('waives the epoch check when the epoch cannot be read', () => {
    const token = createSessionToken(admin, 3, env)
    expect(readSessionToken(token, null, env)).toEqual(admin)
  })

  it('rejects junk', () => {
    expect(readSessionToken(undefined, 1, env)).toBeNull()
    expect(readSessionToken('', 1, env)).toBeNull()
    expect(readSessionToken('no-dot', 1, env)).toBeNull()
    expect(readSessionToken('.sig', 1, env)).toBeNull()
  })
})

describe('cookies', () => {
  it('parses a cookie header', () => {
    expect(parseCookies('a=1; setflow_session=abc%3Ddef; b=2')).toEqual({
      a: '1',
      setflow_session: 'abc=def',
      b: '2',
    })
    expect(parseCookies(undefined)).toEqual({})
  })

  it('marks the cookie HttpOnly and SameSite, and Secure only over https', () => {
    const secure = sessionCookieValue('token', true)
    expect(secure).toContain(`${SESSION_COOKIE}=token`)
    expect(secure).toContain('HttpOnly')
    expect(secure).toContain('SameSite=Lax')
    expect(secure).toContain('Secure')
    expect(sessionCookieValue('token', false)).not.toContain('Secure')
  })

  it('expires the cookie when clearing it', () => {
    expect(sessionCookieValue('', true, 0)).toContain('Max-Age=0')
  })
})

describe('session secret', () => {
  it('reports whether a real secret is configured', () => {
    expect(hasStrongSessionSecret(env)).toBe(true)
    expect(hasStrongSessionSecret({ AUTH_SECRET: 'short' } as NodeJS.ProcessEnv)).toBe(false)
    expect(hasStrongSessionSecret({} as NodeJS.ProcessEnv)).toBe(false)
  })

  it('still signs distinctly when only DATABASE_URL is available', () => {
    const a = { DATABASE_URL: 'postgresql://one/setflow' } as NodeJS.ProcessEnv
    const b = { DATABASE_URL: 'postgresql://two/setflow' } as NodeJS.ProcessEnv
    expect(readSessionToken(createSessionToken(admin, 1, a), 1, b)).toBeNull()
    expect(readSessionToken(createSessionToken(admin, 1, a), 1, a)).toEqual(admin)
  })
})
