import { describe, expect, it, vi } from 'vitest'
import type { NextFunction, Request, Response } from 'express'
import { requireAdmin, requireAuth } from './authMiddleware.ts'
import type { SessionUser } from './auth.ts'

const admin: SessionUser = { id: 'u1', email: 'lead@church.org', name: 'Lead', role: 'admin' }
const member: SessionUser = { id: 'u2', email: 'band@church.org', name: 'Band', role: 'user' }

function call(guard: typeof requireAuth, user?: SessionUser) {
  const req = { user } as Request
  const json = vi.fn()
  const res = { status: vi.fn().mockReturnThis(), json } as unknown as Response
  const next = vi.fn() as unknown as NextFunction
  guard(req, res, next)
  return { res, json, next }
}

describe('requireAuth', () => {
  it('lets a signed-in member through', () => {
    const { next } = call(requireAuth, member)
    expect(next).toHaveBeenCalled()
  })

  it('answers 401 with no session', () => {
    const { res, json, next } = call(requireAuth)
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(401)
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: 'unauthenticated' }))
  })
})

describe('requireAdmin', () => {
  it('lets an admin through', () => {
    const { next } = call(requireAdmin, admin)
    expect(next).toHaveBeenCalled()
  })

  it('answers 403 for a member, distinct from a missing session', () => {
    const { res, json, next } = call(requireAdmin, member)
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: 'forbidden' }))
  })

  it('answers 401 with no session at all', () => {
    const { res, next } = call(requireAdmin)
    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(401)
  })
})
