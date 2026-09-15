import { presentVideoChunkUrls, presentVideoSrc } from '@shared/presentVideo.ts'
import { presentStreamUrl } from './presentVideoSw.ts'
import { pickPresentVideoSrc, type PresentBackground } from './presentBackgrounds.ts'

export function chunkUrlsForBackground(background: PresentBackground): string[] {
  if (background.chunkUrls?.length) return background.chunkUrls
  if (background.chunkBaseUrl && background.sizeBytes && background.sizeBytes > 0) {
    return presentVideoChunkUrls(background.chunkBaseUrl, background.sizeBytes)
  }
  return []
}

export async function resolvePlayablePresentSrc(
  background: PresentBackground,
): Promise<string | undefined> {
  if (background.kind !== 'video') return undefined
  if (!background.custom) return pickPresentVideoSrc(background)
  if (background.src?.startsWith('blob:')) return background.src

  const streamed = await presentStreamUrl(background)
  if (streamed) return streamed

  if (background.src) return background.src
  return presentVideoSrc(background.id)
}
