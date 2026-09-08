import { prisma } from './db.ts'
import { songWithChart } from './songInclude.ts'

const setlistDetailInclude = {
  songs: {
    orderBy: { order: 'asc' as const },
    include: { song: { include: songWithChart } },
  },
  _count: { select: { songs: true } },
}

export async function loadBootstrap() {
  const preferences = await prisma.preference.upsert({
    where: { id: 1 },
    create: { id: 1, theme: 'dark', presentationFontSize: 'medium' },
    update: {},
  })
  const setlists = await prisma.setlist.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      songs: { select: { id: true, songId: true, order: true } },
      _count: { select: { songs: true } },
    },
  })
  const songs = await prisma.song.findMany({
    orderBy: [{ artist: 'asc' }, { title: 'asc' }],
    include: songWithChart,
  })
  const activeId = preferences.lastSetlistId ?? setlists[0]?.id ?? null
  const activeSetlist = activeId
    ? await prisma.setlist.findUnique({
        where: { id: activeId },
        include: setlistDetailInclude,
      })
    : null
  return { preferences, setlists, songs, activeSetlist }
}
