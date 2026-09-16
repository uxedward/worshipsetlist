import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense, useEffect, useState } from 'react'
import { useAuthState, resetTokenFromUrl } from './hooks/useAuth.ts'
import { AuthScreen } from './components/AuthScreen.tsx'
import { BootSplash } from './components/BootSplash.tsx'
import { requestBootstrap } from './lib/api.ts'
import { setLibraryOwner } from './lib/libraryOwner.ts'

const loadAppInner = () => import('./AppInner.tsx').then((mod) => ({ default: mod.AppInner }))
const AppInner = lazy(loadAppInner)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      staleTime: 60_000,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate />
    </QueryClientProvider>
  )
}

/**
 * Nothing below this renders without a session, so the app never briefly shows
 * a library the viewer is not signed in for.
 */
function AuthGate() {
  const auth = useAuthState()
  // A reset link wins over an existing session: whoever opened it is proving
  // they own the account, and they may be on a shared tablet.
  const [resetToken, setResetToken] = useState(resetTokenFromUrl)
  const user = auth.data?.user ?? null
  if (user) setLibraryOwner(user.id)

  useEffect(() => {
    void loadAppInner()
  }, [])

  useEffect(() => {
    if (!user || resetToken) return
    void requestBootstrap()
  }, [user, resetToken])

  if (resetToken || !user) {
    // Paint the sign-in / first-run screen immediately. Waiting on
    // /api/auth/state used to hold a full-app splash until that call returned.
    return (
      <AuthScreen
        needsSetup={Boolean(auth.data?.needsSetup)}
        checking={auth.isPending && !auth.data && !resetToken}
        loadError={auth.isError ? 'Could not reach Setflow. You can still try signing in.' : null}
        resetToken={resetToken}
        onResetDone={() => setResetToken(null)}
      />
    )
  }
  return (
    <Suspense fallback={<BootSplash />}>
      <AppInner />
    </Suspense>
  )
}
