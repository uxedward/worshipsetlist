import { prisma } from './db.ts'
import { setlistWithSongMeta } from './songInclude.ts'

export async function loadBootstrap() {
  const [existingPrefs, setlists, songs] = await Promise.all([
    prisma.preference.findUnique({ where: { id: 1 } }),
    prisma.setlist.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: setlistWithSongMeta,
    }),
    prisma.song.findMany({
      orderBy: [{ artist: 'asc' }, { title: 'asc' }],
    }),
  ])
  const preferences =
    existingPrefs ??
    (await prisma.preference.create({
      data: { id: 1, theme: 'dark', presentationFontSize: 'medium' },
    }))
  const activeId = preferences.lastSetlistId ?? setlists[0]?.id ?? null
  const activeSetlist = setlists.find((setlist) => setlist.id === activeId) ?? null
  return { preferences, setlists, songs, activeSetlist }
}
