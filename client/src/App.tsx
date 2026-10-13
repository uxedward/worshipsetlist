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
 * Guests use the library without signing in. First-run setup and password
 * reset still take over the screen; admins sign in from Settings.
 */
function AuthGate() {
  const auth = useAuthState()
  // A reset link wins over an existing session: whoever opened it is proving
  // they own the account, and they may be on a shared tablet.
  const [resetToken, setResetToken] = useState(resetTokenFromUrl)
  const user = auth.data?.user ?? null
  const needsSetup = Boolean(auth.data?.needsSetup)
  if (user) setLibraryOwner(user.id)

  useEffect(() => {
    void loadAppInner()
  }, [])

  useEffect(() => {
    if (resetToken || needsSetup) return
    void requestBootstrap()
  }, [user, resetToken, needsSetup])

  if (resetToken) {
    return <AuthScreen needsSetup={false} resetToken={resetToken} onResetDone={() => setResetToken(null)} />
  }
  if (auth.isPending && !auth.data) {
    return <AuthScreen needsSetup={false} checking resetToken={null} onResetDone={() => setResetToken(null)} />
  }
  if (needsSetup) {
    return <AuthScreen needsSetup checking={false} resetToken={null} onResetDone={() => setResetToken(null)} />
  }
  return (
    <Suspense fallback={<BootSplash />}>
      <AppInner />
    </Suspense>
  )
}
