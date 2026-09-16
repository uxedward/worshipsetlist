import type { NextFunction, Request, Response } from 'express'
import { SESSION_COOKIE, parseCookies, readSessionToken, type SessionUser } from './auth.ts'
import { currentSessionEpoch } from './sessionEpoch.ts'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser
    }
  }
}

/*
 * These stay generic over the route-params type. A non-generic `Request` would
 * pin Express's inference to ParamsDictionary, and every `req.params.x` in a
 * guarded handler would widen to `string | string[]`.
 */
export async function attachUser<P>(req: Request<P>, _res: Response, next: NextFunction) {
  try {
    const cookies = parseCookies(req.headers.cookie)
    const token = cookies[SESSION_COOKIE]
    req.user = token ? (readSessionToken(token, await currentSessionEpoch()) ?? undefined) : undefined
  } catch {
    req.user = undefined
  }
  next()
}

export function requireAuth<P>(req: Request<P>, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Sign in to continue.', code: 'unauthenticated' })
    return
  }
  next()
}

export function requireAdmin<P>(req: Request<P>, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Sign in to continue.', code: 'unauthenticated' })
    return
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'That action is for admins only.', code: 'forbidden' })
    return
  }
  next()
}
