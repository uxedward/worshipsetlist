import { useEffect } from 'react'
import { onConnectionChange, pingHealth, flushQueue } from '../lib/api.ts'
import { useAppStore } from '../store/useAppStore.ts'

export function useOfflineSync() {
  const setOffline = useAppStore((s) => s.setOffline)
  const setSaveStatus = useAppStore((s) => s.setSaveStatus)

  useEffect(() => {
    const unsub = onConnectionChange((online) => {
      setOffline(!online)
      if (online) {
        void (async () => {
          try {
            await flushQueue()
            setSaveStatus('saved')
          } catch {
            setSaveStatus('saved')
          }
        })()
      }
    })
    const iv = window.setInterval(() => {
      void pingHealth().then(async (ok) => {
        setOffline(!ok)
        if (ok) {
          try {
            await flushQueue()
          } catch {
            /* writes may not persist on the host; local edits still apply */
          }
        }
      })
    }, 30_000)
    return () => {
      unsub()
      window.clearInterval(iv)
    }
  }, [setOffline, setSaveStatus])
}
