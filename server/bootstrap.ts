import { prisma } from './db.ts'
import { setlistWithSongCharts, setlistWithSongMeta } from './songInclude.ts'
import { loadSongCatalog, ownedBy } from './userLibrary.ts'

const GUEST_PREFERENCES = {
  id: 0,
  theme: 'dark' as const,
  presentationFontSize: 'medium' as const,
  lastSetlistId: null,
  onboardingDoneAt: null,
}

/** Songs and Present backgrounds are shared. Guest setlists stay on the device. */
export async function loadGuestBootstrap() {
  const songs = await loadSongCatalog()
  return {
    preferences: GUEST_PREFERENCES,
    setlists: [] as Awaited<ReturnType<typeof loadBootstrap>>['setlists'],
    songs,
    activeSetlist: null,
  }
}

export async function loadBootstrap(userId: string) {
  const owned = ownedBy(userId)
  const [preferencesRow, setlists, songs] = await Promise.all([
    prisma.preference.findUnique({ where: { userId } }),
    prisma.setlist.findMany({
      where: owned,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: setlistWithSongMeta,
    }),
    loadSongCatalog(),
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
