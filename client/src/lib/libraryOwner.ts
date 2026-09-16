import { readAuthCache } from './authCache.ts'

let ownerId: string | null = readAuthCache()?.user?.id ?? null

export function currentLibraryOwner() {
  return ownerId
}

/** Scopes offline persist + bootstrap cache so accounts on one device never mix. */
export function setLibraryOwner(userId: string | null) {
  ownerId = userId?.trim() ? userId : null
}

export function libraryStorageKey(base: string) {
  return ownerId ? `${base}.${ownerId}` : base
}
