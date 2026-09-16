import { Router } from 'express'
import { prisma } from '../db.js'
import {
  clearSessionCookie,
  emailProblem,
  hashPassword,
  normalizeEmail,
  passwordProblem,
  setSessionCookie,
  verifyPassword,
  type Role,
  type SessionUser,
} from '../auth.js'
import { requireAdmin, requireAuth } from '../authMiddleware.js'
import {
  createResetToken,
  hashResetToken,
  requestOrigin,
  resetLinkFor,
  resetTokenProblem,
} from '../passwordReset.js'
import { bumpSessionEpoch, issuingSessionEpoch } from '../sessionEpoch.js'

export const authRouter = Router()

function toSessionUser(row: { id: string; email: string; name: string; role: string }): SessionUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role === 'admin' ? 'admin' : 'user',
  }
}

const publicUser = { id: true, email: true, name: true, role: true, createdAt: true } as const

async function userCount() {
  return prisma.user.count()
}

/** Tells the client whether to show sign-in or first-run setup. */
authRouter.get('/state', async (req, res) => {
  try {
    const count = await userCount()
    res.json({ needsSetup: count === 0, user: req.user ?? null })
  } catch {
    res.json({ needsSetup: false, user: req.user ?? null })
  }
})

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})

/**
 * Creates the very first admin, and only while no user exists. Once one does,
 * accounts come from an admin — there is no open sign-up on a public URL.
 */
authRouter.post('/setup', async (req, res) => {
  if ((await userCount()) > 0) {
    res.status(409).json({ error: 'Setflow already has an account. Ask your admin to add you.' })
    return
  }
  const email = normalizeEmail(req.body?.email)
  const problem = emailProblem(email) || passwordProblem(req.body?.password)
  if (problem) {
    res.status(400).json({ error: problem })
    return
  }
  const name = typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim() : email.split('@')[0]
  const created = await prisma.user.create({
    data: { email, name, role: 'admin', passwordHash: hashPassword(String(req.body.password)) },
    select: publicUser,
  })
  const user = toSessionUser(created)
  await adoptLegacyPreference(user.id)
  setSessionCookie(req, res, user, await issuingSessionEpoch())
  res.status(201).json({ user })
})

authRouter.post('/login', async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  if (!email || !password) {
    res.status(400).json({ error: 'Enter your email and password.' })
    return
  }
  const row = await prisma.user.findUnique({ where: { email } })
  // Same message and roughly the same work either way, so a wrong email and a
  // wrong password are not distinguishable from the outside.
  const ok = row ? verifyPassword(password, row.passwordHash) : verifyPassword(password, DUMMY_HASH)
  if (!row || !ok) {
    res.status(401).json({ error: 'That email and password do not match.' })
    return
  }
  const user = toSessionUser(row)
  setSessionCookie(req, res, user, await issuingSessionEpoch())
  res.json({ user })
})

authRouter.post('/logout', (req, res) => {
  clearSessionCookie(req, res)
  res.json({ ok: true })
})

authRouter.patch('/me', requireAuth, async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
  if (!name) {
    res.status(400).json({ error: 'A name is required.' })
    return
  }
  const updated = await prisma.user.update({
    where: { id: req.user!.id },
    data: { name },
    select: publicUser,
  })
  const user = toSessionUser(updated)
  // The name rides in the cookie, so refresh it rather than wait for expiry.
  setSessionCookie(req, res, user, await issuingSessionEpoch())
  res.json({ user })
})

authRouter.post('/password', requireAuth, async (req, res) => {
  const current = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : ''
  const problem = passwordProblem(req.body?.password)
  if (problem) {
    res.status(400).json({ error: problem })
    return
  }
  const row = await prisma.user.findUnique({ where: { id: req.user!.id } })
  if (!row || !verifyPassword(current, row.passwordHash)) {
    res.status(401).json({ error: 'Your current password is not right.' })
    return
  }
  await prisma.user.update({
    where: { id: row.id },
    data: { passwordHash: hashPassword(String(req.body.password)) },
  })
  res.json({ ok: true })
})

/* --------------------------------------------------------- password resets */

/**
 * Checked before the reset screen renders, so a dead link says so instead of
 * asking for a password it will refuse. Deliberately unauthenticated: whoever
 * holds the link is the person being let back in.
 */
authRouter.get('/reset/:token', async (req, res) => {
  const record = await findReset(req.params.token)
  const problem = resetTokenProblem(record)
  if (problem || !record) {
    res.status(400).json({ error: problem ?? 'That reset link is not valid.' })
    return
  }
  res.json({ email: record.user.email, name: record.user.name })
})

authRouter.post('/reset/:token', async (req, res) => {
  const problem = passwordProblem(req.body?.password)
  if (problem) {
    res.status(400).json({ error: problem })
    return
  }
  const record = await findReset(req.params.token)
  const tokenProblem = resetTokenProblem(record)
  if (tokenProblem || !record) {
    res.status(400).json({ error: tokenProblem ?? 'That reset link is not valid.' })
    return
  }
  const updated = await prisma.$transaction(async (tx) => {
    await tx.passwordReset.update({ where: { id: record.id }, data: { usedAt: new Date() } })
    // Any other outstanding link for this account dies with it.
    await tx.passwordReset.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: new Date() },
    })
    return tx.user.update({
      where: { id: record.userId },
      data: { passwordHash: hashPassword(String(req.body.password)) },
      select: publicUser,
    })
  })
  const user = toSessionUser(updated)
  setSessionCookie(req, res, user, await issuingSessionEpoch())
  res.json({ user })
})

/**
 * Admins hand the returned link to the person directly. There is no mail
 * provider configured, and a self-service "email me a link" flow without one
 * would let anyone reset anyone.
 */
authRouter.post('/users/:id/reset', requireAdmin, async (req, res) => {
  const row = await prisma.user.findUnique({ where: { id: req.params.id } })
  if (!row) {
    res.status(404).json({ error: 'That account no longer exists.' })
    return
  }
  const { token, tokenHash, expiresAt } = createResetToken()
  await prisma.$transaction(async (tx) => {
    await tx.passwordReset.updateMany({
      where: { userId: row.id, usedAt: null },
      data: { usedAt: new Date() },
    })
    await tx.passwordReset.create({ data: { userId: row.id, tokenHash, expiresAt } })
  })
  res.json({
    email: row.email,
    expiresAt: expiresAt.toISOString(),
    link: resetLinkFor(token, requestOrigin(req.headers)),
  })
})

/* ------------------------------------------------------- admin: manage users */

authRouter.get('/users', requireAdmin, async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: [{ role: 'asc' }, { email: 'asc' }], select: publicUser })
  res.json(users)
})

authRouter.post('/users', requireAdmin, async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  const problem = emailProblem(email) || passwordProblem(req.body?.password)
  if (problem) {
    res.status(400).json({ error: problem })
    return
  }
  const role: Role = req.body?.role === 'admin' ? 'admin' : 'user'
  const name = typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim() : email.split('@')[0]
  if (await prisma.user.findUnique({ where: { email } })) {
    res.status(409).json({ error: 'Someone already uses that email.' })
    return
  }
  const created = await prisma.user.create({
    data: { email, name, role, passwordHash: hashPassword(String(req.body.password)) },
    select: publicUser,
  })
  res.status(201).json(created)
})

authRouter.patch('/users/:id', requireAdmin, async (req, res) => {
  const row = await prisma.user.findUnique({ where: { id: req.params.id } })
  if (!row) {
    res.status(404).json({ error: 'That account no longer exists.' })
    return
  }
  const data: { name?: string; role?: string; passwordHash?: string } = {}
  if (typeof req.body?.name === 'string' && req.body.name.trim()) data.name = req.body.name.trim()
  if (req.body?.role === 'admin' || req.body?.role === 'user') data.role = req.body.role
  if (req.body?.password !== undefined) {
    const problem = passwordProblem(req.body.password)
    if (problem) {
      res.status(400).json({ error: problem })
      return
    }
    data.passwordHash = hashPassword(String(req.body.password))
  }
  if (data.role && data.role !== 'admin' && row.role === 'admin' && (await adminCount()) <= 1) {
    res.status(400).json({ error: 'Setflow needs at least one admin.' })
    return
  }
  const updated = await prisma.user.update({ where: { id: row.id }, data, select: publicUser })
  // A demotion or a new password must not leave the old cookie usable.
  if (data.role || data.passwordHash) {
    await bumpSessionEpoch()
    await reissueActingAdmin(req, res, updated)
  }
  res.json(updated)
})

authRouter.delete('/users/:id', requireAdmin, async (req, res) => {
  const row = await prisma.user.findUnique({ where: { id: req.params.id } })
  if (!row) {
    res.json({ ok: true })
    return
  }
  if (row.id === req.user!.id) {
    res.status(400).json({ error: 'You cannot remove your own account.' })
    return
  }
  if (row.role === 'admin' && (await adminCount()) <= 1) {
    res.status(400).json({ error: 'Setflow needs at least one admin.' })
    return
  }
  await prisma.user.delete({ where: { id: row.id } })
  await bumpSessionEpoch()
  await reissueActingAdmin(req, res)
  res.json({ ok: true })
})

/**
 * Bumping the epoch invalidates every cookie, including the admin's own. Hand
 * them a fresh one so removing someone does not sign the remover out too.
 */
async function reissueActingAdmin(
  req: Parameters<typeof setSessionCookie>[0],
  res: Parameters<typeof setSessionCookie>[1],
  updatedSelf?: { id: string; email: string; name: string; role: string },
) {
  const me = req.user
  if (!me) return
  const next = updatedSelf && updatedSelf.id === me.id ? toSessionUser(updatedSelf) : me
  setSessionCookie(req, res, next, await issuingSessionEpoch())
}

async function findReset(token: string) {
  if (!token) return null
  return prisma.passwordReset.findUnique({
    where: { tokenHash: hashResetToken(token) },
    include: { user: { select: { email: true, name: true } } },
  })
}

const DUMMY_HASH = hashPassword('setflow-timing-equalizer')

async function adminCount() {
  return prisma.user.count({ where: { role: 'admin' } })
}

/** Hands the pre-accounts preference row (userId IS NULL) to the first admin. */
async function adoptLegacyPreference(userId: string) {
  try {
    const legacy = await prisma.preference.findFirst({ where: { userId: null }, orderBy: { id: 'asc' } })
    if (legacy) await prisma.preference.update({ where: { id: legacy.id }, data: { userId } })
  } catch {
    /* a fresh database has nothing to adopt */
  }
}
