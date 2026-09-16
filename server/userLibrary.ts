import { prisma } from './db.ts'

export function ownedBy(userId: string) {
  return { userId }
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
