import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { endpoints, onAuthLost, releaseQueue, type AccountUser, type Role } from '../lib/api.ts'
import { readAuthCache, writeAuthCache } from '../lib/authCache.ts'
import { setLibraryOwner } from '../lib/libraryOwner.ts'

export const AUTH_KEY = ['auth', 'state'] as const

export function useAuthState() {
  const qc = useQueryClient()

  useEffect(
    () =>
      onAuthLost(() => {
        qc.setQueryData(AUTH_KEY, (prev: { needsSetup: boolean; user: AccountUser | null } | undefined) => {
          const next = prev ? { ...prev, user: null } : { needsSetup: false, user: null }
          writeAuthCache(next)
          return next
        })
      }),
    [qc],
  )

  return useQuery({
    queryKey: AUTH_KEY,
    queryFn: async () => {
      const data = await endpoints.authState()
      writeAuthCache(data)
      return data
    },
    retry: 1,
    staleTime: 5 * 60_000,
    placeholderData: readAuthCache(),
  })
}

/** Signing in switches to that account's library cache. */
function useAdoptSession() {
  const qc = useQueryClient()
  return (user: AccountUser) => {
    setLibraryOwner(user.id)
    releaseQueue()
    const next = { needsSetup: false, user }
    writeAuthCache(next)
    qc.setQueryData(AUTH_KEY, next)
    qc.removeQueries({
      predicate: (query) => query.queryKey[0] !== 'auth',
    })
  }
}

export function useLogin() {
  const adopt = useAdoptSession()
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      endpoints.login(email, password),
    onSuccess: (data) => adopt(data.user),
  })
}

export function useSetupAdmin() {
  const adopt = useAdoptSession()
  return useMutation({
    mutationFn: (body: { email: string; password: string; name: string }) => endpoints.setupAdmin(body),
    onSuccess: (data) => adopt(data.user),
  })
}

export function useSignup() {
  const adopt = useAdoptSession()
  return useMutation({
    mutationFn: (body: { email: string; password: string; name: string }) => endpoints.signup(body),
    onSuccess: (data) => adopt(data.user),
  })
}

/** The reset link lands on the app root as ?reset=<token>. */
export function resetTokenFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('reset')
}

export function clearResetTokenFromUrl() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.delete('reset')
  window.history.replaceState({}, '', url.pathname + url.search + url.hash)
}

export function useResetToken(token: string | null) {
  return useQuery({
    queryKey: ['auth', 'reset', token],
    queryFn: () => endpoints.checkResetToken(token!),
    enabled: Boolean(token),
    retry: false,
  })
}

export function useCompleteReset() {
  const adopt = useAdoptSession()
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      endpoints.completeReset(token, password),
    onSuccess: (data) => {
      clearResetTokenFromUrl()
      adopt(data.user)
    },
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => endpoints.updateProfile(name),
    onSuccess: (data) => {
      qc.setQueryData(AUTH_KEY, { needsSetup: false, user: data.user })
      writeAuthCache({ needsSetup: false, user: data.user })
    },
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ currentPassword, password }: { currentPassword: string; password: string }) =>
      endpoints.changePassword(currentPassword, password),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: endpoints.logout,
    onSuccess: () => {
      setLibraryOwner(null)
      const next = { needsSetup: false, user: null }
      writeAuthCache(next)
      qc.setQueryData(AUTH_KEY, next)
      // Nothing cached belongs to the next person to sign in on this device.
      qc.clear()
    },
  })
}

/**
 * Subscribes to the session without re-fetching it — `useAuthState` at the app
 * root owns the request. Reading the cache directly would not re-render on
 * sign-out, which is exactly when the UI has to change.
 */
export function useCurrentUser(): AccountUser | null {
  const { data } = useQuery({
    queryKey: AUTH_KEY,
    queryFn: endpoints.authState,
    enabled: false,
    staleTime: Infinity,
  })
  return data?.user ?? null
}

export function useRole(): Role | null {
  return useCurrentUser()?.role ?? null
}

/**
 * Hides admin-only controls. The server enforces the same rule — this only
 * keeps people from reaching for a button that would be refused.
 */
export function useIsAdmin(): boolean {
  return useRole() === 'admin'
}
