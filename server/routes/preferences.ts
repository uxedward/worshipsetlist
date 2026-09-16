import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth } from '../authMiddleware.js'

export const preferencesRouter = Router()

/** Preferences are per-account: theme and last setlist no longer collide. */
export async function preferencesFor(userId: string) {
  const existing = await prisma.preference.findUnique({ where: { userId } })
  if (existing) return existing
  return prisma.preference.create({
    data: { userId, theme: 'dark', presentationFontSize: 'medium' },
  })
}

preferencesRouter.use(requireAuth)

preferencesRouter.get('/', async (req, res) => {
  res.json(await preferencesFor(req.user!.id))
})

preferencesRouter.patch('/', async (req, res) => {
  const data: {
    theme?: string
    presentationFontSize?: string
    lastSetlistId?: string | null
  } = {}
  if (req.body.theme === 'dark' || req.body.theme === 'light') data.theme = req.body.theme
  if (
    req.body.presentationFontSize === 'small' ||
    req.body.presentationFontSize === 'medium' ||
    req.body.presentationFontSize === 'large'
  ) {
    data.presentationFontSize = req.body.presentationFontSize
  }
  if ('lastSetlistId' in req.body) data.lastSetlistId = req.body.lastSetlistId

  const userId = req.user!.id
  await preferencesFor(userId)
  const prefs = await prisma.preference.update({ where: { userId }, data })
  res.json(prefs)
})
