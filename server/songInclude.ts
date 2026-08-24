export const songWithChart = {
  sections: {
    orderBy: { order: 'asc' as const },
    include: {
      lines: { orderBy: { order: 'asc' as const } },
    },
  },
} as const
