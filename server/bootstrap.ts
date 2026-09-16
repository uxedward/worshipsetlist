import { prisma } from './db.ts'
import { setlistWithSongCharts } from './songInclude.ts'

export async function loadBootstrap(userId: string) {
  const [preferencesRow, setlists, songs] = await Promise.all([
    prisma.preference.findUnique({ where: { userId } }),
    prisma.setlist.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: setlistWithSongCharts,
    }),
    prisma.song.findMany({
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
  const activeSetlist = setlists.find((setlist) => setlist.id === activeId) ?? null
  return { preferences, setlists, songs, activeSetlist }
}
