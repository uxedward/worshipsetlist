import { MAX_PRESENT_VIDEO_BYTES } from '../shared/presentVideo.ts'
import { prisma } from './db.ts'
import {
  deleteSupabasePrefix,
  emptyPresentVideoBucket,
  listStorageFolders,
  supabaseConfig,
} from './videoHosting.ts'

export type StoredBackgroundRow = {
  id: string
  src: string
  sizeBytes: number
}

export type ReclaimPresentStorageResult = {
  droppedChunks: number
  droppedBackgrounds: number
  droppedStoragePrefixes: number
  emptiedBucket: boolean
  keptBackgrounds: number
}

/** Keep playable clips at or under the upload cap; drop stubs and oversized 4K dumps. */
export function shouldKeepCustomBackground(
  row: StoredBackgroundRow,
  maxBytes = MAX_PRESENT_VIDEO_BYTES,
) {
  if (row.sizeBytes > maxBytes) return false
  if (row.sizeBytes <= 0 && !/^https?:\/\//i.test(row.src)) return false
  return true
}

export function orphanStoragePrefixes(folderNames: string[], keepIds: Iterable<string>) {
  const keep = new Set(keepIds)
  const orphans: string[] = []
  for (const raw of folderNames) {
    const id = raw.replace(/\/+$/, '')
    if (!/^custom-[a-zA-Z0-9-]+$/.test(id)) continue
    if (keep.has(id)) continue
    orphans.push(id)
  }
  return orphans
}

export async function reclaimPresentVideoData(): Promise<ReclaimPresentStorageResult> {
  const result: ReclaimPresentStorageResult = {
    droppedChunks: 0,
    droppedBackgrounds: 0,
    droppedStoragePrefixes: 0,
    emptiedBucket: false,
    keptBackgrounds: 0,
  }

  try {
    const chunks = await prisma.backgroundChunk.deleteMany({})
    result.droppedChunks = chunks.count
  } catch {
    /* table may not exist yet */
  }

  let rows: StoredBackgroundRow[] = []
  let loadedRows = false
  try {
    rows = await prisma.customBackground.findMany({
      select: { id: true, src: true, sizeBytes: true },
    })
    loadedRows = true
  } catch {
    rows = []
  }

  const keep = rows.filter((row) => shouldKeepCustomBackground(row))
  const drop = rows.filter((row) => !shouldKeepCustomBackground(row))
  result.keptBackgrounds = keep.length

  for (const row of drop) {
    try {
      await deleteSupabasePrefix(row.id)
      result.droppedStoragePrefixes += 1
    } catch {
      /* keep going — a later empty-bucket pass may still free quota */
    }
    try {
      await prisma.customBackground.delete({ where: { id: row.id } })
      result.droppedBackgrounds += 1
    } catch {
      /* already gone */
    }
  }

  const keepIds = keep.map((row) => row.id)
  if (supabaseConfig()) {
    try {
      const folders = await listStorageFolders()
      for (const id of orphanStoragePrefixes(folders, keepIds)) {
        try {
          await deleteSupabasePrefix(id)
          result.droppedStoragePrefixes += 1
        } catch {
          /* keep going */
        }
      }
    } catch {
      /* listing can 402 while over quota */
    }

    if (loadedRows && keepIds.length === 0) {
      try {
        await emptyPresentVideoBucket()
        result.emptiedBucket = true
      } catch {
        /* dashboard delete of present-videos may still be required */
      }
    }
  }

  return result
}

let reclaiming: Promise<ReclaimPresentStorageResult> | null = null

/** One in-flight reclaim per isolate so Present list/open does not stampede Storage. */
export function reclaimPresentVideoDataOnce() {
  if (!reclaiming) {
    reclaiming = reclaimPresentVideoData().finally(() => {
      setTimeout(() => {
        reclaiming = null
      }, 30_000)
    })
  }
  return reclaiming
}
