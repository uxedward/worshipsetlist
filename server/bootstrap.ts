import { prisma } from './db.ts'
import { setlistWithSongCharts, setlistWithSongMeta } from './songInclude.ts'
import { ownedBy } from './userLibrary.ts'

export async function loadBootstrap(userId: string) {
  const owned = ownedBy(userId)
  const [preferencesRow, setlists, songs] = await Promise.all([
    prisma.preference.findUnique({ where: { userId } }),
    prisma.setlist.findMany({
      where: owned,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: setlistWithSongMeta,
    }),
    prisma.song.findMany({
      where: owned,
      orderBy: [{ artist: 'asc' }, { title: 'asc' }],
    }),
  ])
  let preferences = preferencesRow
  if (!preferences) {
    preferences = await prisma.preference.create({
      data: { userId, theme: 'dark', presentationFontSize: 'medium' },
    })
  }
  const activeId = preferences.lastSetlistId ?? setlists[0]?.id ?? null
  const activeSetlist = activeId
    ? await prisma.setlist.findFirst({
        where: { id: activeId, ...owned },
        include: setlistWithSongCharts,
      })
    : null
  return { preferences, setlists, songs, activeSetlist }
}
