import type { AccountUser } from './api.ts'

export const AUTH_CACHE_KEY = 'setflow.auth.state.v1'

export type AuthCacheState = { needsSetup: boolean; user: AccountUser | null }

export function readAuthCache(): AuthCacheState | undefined {
  if (typeof sessionStorage === 'undefined') return undefined
  try {
    const raw = sessionStorage.getItem(AUTH_CACHE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as AuthCacheState
    if (typeof parsed?.needsSetup !== 'boolean') return undefined
    if (parsed.user && typeof parsed.user.id !== 'string') return undefined
    return parsed
  } catch {
    return undefined
  }
}

export function writeAuthCache(state: AuthCacheState) {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(state))
  } catch {
    /* private mode / quota */
  }
}
