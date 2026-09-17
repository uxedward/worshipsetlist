import { prisma } from './db.ts'

export function ownedBy(userId: string) {
  return { userId }
}

export const sharedSongOrder = [{ artist: 'asc' as const }, { title: 'asc' as const }]

/** Every signed-in account reads the same admin song catalog. */
export function loadSongCatalog() {
  return prisma.song.findMany({ orderBy: sharedSongOrder })
}

/** Rows created before accounts existed belong to the first admin. */
export async function claimUnownedLibrary() {
  const owner = await prisma.user.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (!owner) return
  await prisma.$transaction([
    prisma.song.updateMany({ where: { userId: null }, data: { userId: owner.id } }),
    prisma.setlist.updateMany({ where: { userId: null }, data: { userId: owner.id } }),
  ])
}
