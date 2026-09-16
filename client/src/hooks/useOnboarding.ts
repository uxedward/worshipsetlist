import { useQuery } from '@tanstack/react-query'
import { endpoints } from '../lib/api.ts'
import { useCurrentUser } from './useAuth.ts'
import { usePreferences, useSetlists, useSongs } from './useQueries.ts'

export type OnboardingStep = {
  id: 'songs' | 'setlist' | 'team' | 'background'
  title: string
  blurb: string
  action: string
  done: boolean
  adminOnly?: boolean
}

/**
 * Every step reads its state from data the app already has, so the checklist
 * cannot drift from reality — importing songs in a second tab ticks the first
 * box here. Only "I'm finished with this" is stored, on the account.
 */
export function useOnboarding() {
  const user = useCurrentUser()
  const isAdmin = user?.role === 'admin'
  const prefs = usePreferences()
  const songs = useSongs({})
  const setlists = useSetlists()

  const backgrounds = useQuery({
    queryKey: ['backgrounds'],
    queryFn: endpoints.backgrounds,
    enabled: Boolean(isAdmin),
    staleTime: 5 * 60_000,
  })

  const team = useQuery({
    queryKey: ['auth', 'users'],
    queryFn: endpoints.listUsers,
    enabled: Boolean(isAdmin),
    staleTime: 5 * 60_000,
  })

  const songCount = songs.data?.length ?? 0
  const hasFullSetlist = (setlists.data ?? []).some((setlist) => (setlist._count?.songs ?? setlist.songs?.length ?? 0) > 0)

  const steps: OnboardingStep[] = [
    {
      id: 'songs',
      title: 'Add your first songs',
      blurb: 'Paste a Spotify playlist or type a chart by hand.',
      action: 'Open the library',
      done: songCount > 0,
    },
    {
      id: 'setlist',
      title: 'Build a setlist',
      blurb: 'Drop songs into Sunday AM and set the keys you play in.',
      action: 'Go to setlists',
      done: hasFullSetlist,
    },
    {
      id: 'team',
      title: 'Invite your team',
      blurb: 'They can add songs and run Present mode, but not delete anything.',
      action: 'Add accounts',
      done: (team.data?.length ?? 1) > 1,
      adminOnly: true,
    },
    {
      id: 'background',
      title: 'Pick a Present background',
      blurb: 'Upload a video loop, or use one of the built-in gradients.',
      action: 'Open Present mode',
      done: (backgrounds.data?.backgrounds.length ?? 0) > 0,
      adminOnly: true,
    },
  ]

  const visible = steps.filter((step) => !step.adminOnly || isAdmin)
  const complete = visible.filter((step) => step.done).length
  const dismissed = Boolean(prefs.data?.onboardingDoneAt)
  // Still loading counts as "nothing to show" so the panel never flashes in.
  const loading = songs.isPending || setlists.isPending || prefs.isPending

  return {
    steps: visible,
    complete,
    total: visible.length,
    allDone: complete === visible.length,
    show: !loading && !dismissed,
  }
}
