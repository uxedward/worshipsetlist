import type { SetlistSong } from '@shared/types.ts'
import { soundingKey } from '@shared/transpose.ts'

export function buildSetlistPlain(songs: SetlistSong[]): string {
  return songs
    .map((ss, i) => `${i + 1}. ${ss.song.title} — ${soundingKey(ss.song.key, ss.transposedKey)} — ${ss.song.bpm} BPM`)
    .join('\n')
}
