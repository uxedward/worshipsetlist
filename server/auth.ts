import crypto from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

export type Role = 'admin' | 'user'

export interface SessionUser {
  id: string
  email: string
  name: string
  role: Role
}

export const SESSION_COOKIE = 'setflow_session'
/** Long enough that a tablet on the platform stays signed in between services. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 60

const SCRYPT_N = 16384
const SCRYPT_r = 8
const SCRYPT_p = 1
const KEY_LEN = 64

/* ---------------------------------------------------------------- passwords */

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16)
  const key = crypto.scryptSync(password.normalize('NFKC'), salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_r,
    p: SCRYPT_p,
  })
  return ['scrypt', SCRYPT_N, SCRYPT_r, SCRYPT_p, salt.toString('hex'), key.toString('hex')].join('$')
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = (stored || '').split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, nRaw, rRaw, pRaw, saltHex, keyHex] = parts
  const N = Number(nRaw)
  const r = Number(rRaw)
  const p = Number(pRaw)
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false
  let expected: Buffer
  try {
    expected = Buffer.from(keyHex, 'hex')
  } catch {
    return false
  }
  if (expected.length === 0) return false
  const actual = crypto.scryptSync(password.normalize('NFKC'), Buffer.from(saltHex, 'hex'), expected.length, {
    N,
    r,
    p,
  })
  return crypto.timingSafeEqual(actual, expected)
}

/** Rules the login form mirrors, so the two never disagree. */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== 'string' || !password) return 'A password is required.'
  if (password.length < 8) return 'Use at least 8 characters.'
  if (password.length > 200) return 'That password is too long.'
  return null
}

export function normalizeEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

export function emailProblem(email: unknown): string | null {
  const value = normalizeEmail(email)
  if (!value) return 'An email is required.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'That email does not look right.'
  return null
}

export function nameProblem(name: unknown): string | null {
  if (typeof name !== 'string' || !name.trim()) return 'A name is required.'
  if (name.trim().length > 80) return 'That name is too long.'
  return null
}

/* ----------------------------------------------------------------- sessions */

/**
 * The cookie carries id/role, so an authorization check costs no query. This
 * app already fights Postgres pool timeouts; a per-request user lookup would
 * make that worse. Revocation rides on a single global `sessionEpoch` that is
 * read once per isolate per minute: removing a user or changing a role bumps
 * it, which signs everyone out rather than leaving a stale cookie valid.
 */
export function sessionSecret(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.AUTH_SECRET || env.SESSION_SECRET
  if (explicit && explicit.length >= 16) return explicit
  // Fall back to something stable and already secret so dev works unconfigured.
  const fallback = env.DATABASE_URL || env.POSTGRES_PRISMA_URL || env.POSTGRES_URL
  if (fallback) return crypto.createHash('sha256').update(`setflow:${fallback}`).digest('hex')
  return 'setflow-insecure-development-secret'
}

export function hasStrongSessionSecret(env: NodeJS.ProcessEnv = process.env): boolean {
  const explicit = env.AUTH_SECRET || env.SESSION_SECRET
  return Boolean(explicit && explicit.length >= 16)
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

function sign(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url')
}

export interface TokenPayload extends SessionUser {
  exp: number
  ep: number
}

export function createSessionToken(
  user: SessionUser,
  epoch: number,
  env: NodeJS.ProcessEnv = process.env,
  now = Date.now(),
): string {
  const payload: TokenPayload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    ep: epoch,
    exp: Math.floor(now / 1000) + SESSION_MAX_AGE_SECONDS,
  }
  const body = b64url(JSON.stringify(payload))
  return `${body}.${sign(body, sessionSecret(env))}`
}

export function readSessionToken(
  token: string | undefined,
  /** null waives the revocation check, for when the epoch cannot be read. */
  epoch: number | null,
  env: NodeJS.ProcessEnv = process.env,
  now = Date.now(),
): SessionUser | null {
  if (!token) return null
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const body = token.slice(0, dot)
  const signature = token.slice(dot + 1)
  const expected = sign(body, sessionSecret(env))
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  let payload: TokenPayload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TokenPayload
  } catch {
    return null
  }
  if (!payload?.id || (payload.role !== 'admin' && payload.role !== 'user')) return null
  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= now) return null
  if (epoch !== null && payload.ep !== epoch) return null
  return { id: payload.id, email: payload.email, name: payload.name, role: payload.role }
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    const key = part.slice(0, eq).trim()
    if (!key) continue
    try {
      out[key] = decodeURIComponent(part.slice(eq + 1).trim())
    } catch {
      out[key] = part.slice(eq + 1).trim()
    }
  }
  return out
}

export function sessionCookieValue(token: string, secure: boolean, maxAge = SESSION_MAX_AGE_SECONDS): string {
  const bits = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ]
  if (secure) bits.push('Secure')
  return bits.join('; ')
}

function isSecureRequest(req: Request): boolean {
  if (process.env.VERCEL) return true
  const proto = req.headers['x-forwarded-proto']
  const value = Array.isArray(proto) ? proto[0] : proto
  return value === 'https'
}

export function setSessionCookie(req: Request, res: Response, user: SessionUser, epoch: number) {
  res.setHeader('Set-Cookie', sessionCookieValue(createSessionToken(user, epoch), isSecureRequest(req)))
}

export function clearSessionCookie(req: Request, res: Response) {
  res.setHeader('Set-Cookie', sessionCookieValue('', isSecureRequest(req), 0))
}
