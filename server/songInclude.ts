export const songWithChart = {
  sections: {
    orderBy: { order: 'asc' as const },
    include: {
      lines: { orderBy: { order: 'asc' as const } },
    },
  },
} as const

/** Nested song on setlists / library lists — metadata only, no lyric lines. */
export const setlistWithSongMeta = {
  songs: {
    orderBy: { order: 'asc' as const },
    include: { song: true },
  },
  _count: { select: { songs: true } },
} as const
