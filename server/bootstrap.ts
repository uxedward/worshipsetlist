import { prisma } from './db.ts'
import { setlistWithSongMeta } from './songInclude.ts'

export async function loadBootstrap() {
  let preferences = await prisma.preference.findUnique({ where: { id: 1 } })
  if (!preferences) {
    preferences = await prisma.preference.create({
      data: { id: 1, theme: 'dark', presentationFontSize: 'medium' },
    })
  }
  const setlists = await prisma.setlist.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: setlistWithSongMeta,
  })
  const songs = await prisma.song.findMany({
    orderBy: [{ artist: 'asc' }, { title: 'asc' }],
  })
  const activeId = preferences.lastSetlistId ?? setlists[0]?.id ?? null
  const activeSetlist = setlists.find((setlist) => setlist.id === activeId) ?? null
  return { preferences, setlists, songs, activeSetlist }
}
