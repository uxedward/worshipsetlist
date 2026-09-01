import { Router } from 'express'
import { prisma } from '../db'

export const preferencesRouter = Router()

async function getOrCreate() {
  return prisma.preference.upsert({
    where: { id: 1 },
    create: { id: 1, theme: 'dark', presentationFontSize: 'medium' },
    update: {},
  })
}

preferencesRouter.get('/', async (_req, res) => {
  const prefs = await getOrCreate()
  res.json(prefs)
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

  const prefs = await prisma.preference.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      theme: data.theme ?? 'dark',
      presentationFontSize: data.presentationFontSize ?? 'medium',
      lastSetlistId: data.lastSetlistId ?? null,
    },
    update: data,
  })
  res.json(prefs)
})
