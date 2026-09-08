export function songsListQueryKey(
  params: { search?: string; artist?: string; tag?: string; sort?: string } = {},
) {
  return ['songs', params.search ?? '', params.artist ?? '', params.tag ?? '', params.sort || 'artist'] as const
}
