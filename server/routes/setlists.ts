import { Router } from 'express'
import { prisma } from '../db.js'
import { setlistWithSongMeta } from '../songInclude.js'
import { requireAuth } from '../authMiddleware.js'
import { ownedBy } from '../userLibrary.js'

export const setlistsRouter = Router()

setlistsRouter.use(requireAuth)

const setlistInclude = setlistWithSongMeta

setlistsRouter.get('/', async (req, res) => {
  const setlists = await prisma.setlist.findMany({
    where: ownedBy(req.user!.id),
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      songs: { select: { id: true, songId: true, order: true } },
      _count: { select: { songs: true } },
    },
  })
  res.json(setlists)
})

setlistsRouter.put('/reorder', async (req, res) => {
  const userId = req.user!.id
  const ids: string[] = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds : []
  if (ids.length > 0) {
    await prisma.$transaction(
      ids.map((id, sortOrder) =>
        prisma.setlist.updateMany({
          where: { id, userId },
          data: { sortOrder },
        }),
      ),
    )
  }
  const setlists = await prisma.setlist.findMany({
    where: ownedBy(userId),
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      songs: { select: { id: true, songId: true, order: true } },
      _count: { select: { songs: true } },
    },
  })
  res.json(setlists)
})

setlistsRouter.get('/:id', async (req, res) => {
  const setlist = await prisma.setlist.findFirst({
    where: { id: req.params.id, ...ownedBy(req.user!.id) },
    include: setlistInclude,
  })
  if (!setlist) {
    res.status(404).json({ error: 'Setlist not found' })
    return
  }
  res.json(setlist)
})

setlistsRouter.post('/', async (req, res) => {
  const name = String(req.body?.name ?? '').trim()
  if (!name) {
    res.status(400).json({ error: 'Name is required' })
    return
  }
  const userId = req.user!.id
  const owned = ownedBy(userId)
  const count = await prisma.setlist.count({ where: owned })
  const maxOrder = await prisma.setlist.aggregate({ where: owned, _max: { sortOrder: true } })
  const setlist = await prisma.setlist.create({
    data: {
      userId,
      name,
      description: req.body.description ?? null,
      serviceName: req.body.serviceName ?? null,
      date: req.body.date ? new Date(req.body.date) : null,
      colorIndex: typeof req.body.colorIndex === 'number' ? req.body.colorIndex : count % 5,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
    include: setlistInclude,
  })
  res.status(201).json(setlist)
})

setlistsRouter.patch('/:id', async (req, res) => {
  const existing = await prisma.setlist.findFirst({
    where: { id: req.params.id, ...ownedBy(req.user!.id) },
  })
  if (!existing) {
    res.status(404).json({ error: 'Setlist not found' })
    return
  }
  const data: {
    name?: string
    description?: string | null
    serviceName?: string | null
    date?: Date | null
    colorIndex?: number
  } = {}
  if (typeof req.body.name === 'string') data.name = req.body.name.trim()
  if ('description' in req.body) data.description = req.body.description
  if ('serviceName' in req.body) data.serviceName = req.body.serviceName
  if ('date' in req.body) data.date = req.body.date ? new Date(req.body.date) : null
  if (typeof req.body.colorIndex === 'number') data.colorIndex = req.body.colorIndex

  const setlist = await prisma.setlist.update({
    where: { id: req.params.id },
    data,
    include: setlistInclude,
  })
  res.json(setlist)
})

setlistsRouter.delete('/:id', async (req, res) => {
  const userId = req.user!.id
  const existing = await prisma.setlist.findFirst({
    where: { id: req.params.id, ...ownedBy(userId) },
  })
  if (!existing) {
    res.status(404).json({ error: 'Setlist not found' })
    return
  }
  await prisma.setlist.delete({ where: { id: req.params.id } })

  const remaining = await prisma.setlist.findMany({
    where: ownedBy(userId),
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  const nextId = remaining[0]?.id ?? null

  await prisma.preference.updateMany({
    where: { userId, lastSetlistId: req.params.id },
    data: { lastSetlistId: nextId },
  })

  res.json({ ok: true, nextId })
})

setlistsRouter.post('/:id/duplicate', async (req, res) => {
  const userId = req.user!.id
  const source = await prisma.setlist.findFirst({
    where: { id: req.params.id, ...ownedBy(userId) },
    include: { songs: true },
  })
  if (!source) {
    res.status(404).json({ error: 'Setlist not found' })
    return
  }
  const maxOrder = await prisma.setlist.aggregate({
    where: ownedBy(userId),
    _max: { sortOrder: true },
  })
  const copy = await prisma.setlist.create({
    data: {
      userId,
      name: `Copy of ${source.name}`,
      description: source.description,
      serviceName: source.serviceName,
      date: new Date(),
      colorIndex: source.colorIndex,
      sortOrder: (maxOrder._max.sortOrder ?? source.sortOrder) + 1,
      songs: {
        create: source.songs.map((s) => ({
          songId: s.songId,
          order: s.order,
          transposedKey: s.transposedKey,
          notes: s.notes,
        })),
      },
    },
    include: setlistInclude,
  })
  res.status(201).json(copy)
})

setlistsRouter.post('/:id/songs', async (req, res) => {
  const userId = req.user!.id
  const setlist = await prisma.setlist.findFirst({
    where: { id: req.params.id, ...ownedBy(userId) },
    include: { songs: true },
  })
  if (!setlist) {
    res.status(404).json({ error: 'Setlist not found' })
    return
  }
  const songId = String(req.body?.songId ?? '')
  const song = await prisma.song.findFirst({ where: { id: songId, ...ownedBy(userId) } })
  if (!song) {
    res.status(404).json({ error: 'Song not found' })
    return
  }
  const maxOrder = setlist.songs.reduce((m, s) => Math.max(m, s.order), -1)
  const already = setlist.songs.find((s) => s.songId === songId)
  if (already) {
    const row = await prisma.setlistSong.findUnique({
      where: { id: already.id },
      include: { song: true },
    })
    res.status(200).json(row)
    return
  }
  const row = await prisma.setlistSong.create({
    data: {
      setlistId: setlist.id,
      songId,
      order: typeof req.body.order === 'number' ? req.body.order : maxOrder + 1,
    },
    include: { song: true },
  })
  res.status(201).json(row)
})

setlistsRouter.patch('/:id/songs/:ssId', async (req, res) => {
  const setlist = await prisma.setlist.findFirst({
    where: { id: req.params.id, ...ownedBy(req.user!.id) },
    select: { id: true },
  })
  if (!setlist) {
    res.status(404).json({ error: 'Setlist not found' })
    return
  }
  const row = await prisma.setlistSong.findFirst({
    where: { id: req.params.ssId, setlistId: req.params.id },
  })
  if (!row) {
    res.status(404).json({ error: 'Setlist song not found' })
    return
  }
  const data: { transposedKey?: string | null; notes?: string | null; order?: number } = {}
  if ('transposedKey' in req.body) data.transposedKey = req.body.transposedKey
  if ('notes' in req.body) data.notes = req.body.notes
  if (typeof req.body.order === 'number') data.order = req.body.order
  const updated = await prisma.setlistSong.update({
    where: { id: row.id },
    data,
    include: { song: true },
  })
  res.json(updated)
})

setlistsRouter.delete('/:id/songs/:ssId', async (req, res) => {
  const setlist = await prisma.setlist.findFirst({
    where: { id: req.params.id, ...ownedBy(req.user!.id) },
    select: { id: true },
  })
  if (!setlist) {
    res.status(404).json({ error: 'Setlist not found' })
    return
  }
  const row = await prisma.setlistSong.findFirst({
    where: { id: req.params.ssId, setlistId: req.params.id },
  })
  if (!row) {
    res.status(404).json({ error: 'Setlist song not found' })
    return
  }
  await prisma.setlistSong.delete({ where: { id: row.id } })
  res.json({ ok: true })
})

setlistsRouter.put('/:id/reorder', async (req, res) => {
  const ids: string[] = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds : []
  const setlist = await prisma.setlist.findFirst({
    where: { id: req.params.id, ...ownedBy(req.user!.id) },
    include: { songs: true },
  })
  if (!setlist) {
    res.status(404).json({ error: 'Setlist not found' })
    return
  }
  await prisma.$transaction(
    ids.map((id, order) =>
      prisma.setlistSong.update({
        where: { id },
        data: { order },
      }),
    ),
  )
  const updated = await prisma.setlist.findUnique({
    where: { id: req.params.id },
    include: setlistInclude,
  })
  res.json(updated)
})
