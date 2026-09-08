import { useEffect } from 'react'
import { endpoints, flushQueue, onConnectionChange, pingHealth } from '../lib/api.ts'
import { flushLocalSongsToDatabase } from './useQueries.ts'
import { useAppStore } from '../store/useAppStore.ts'

export function useOfflineSync() {
  const setOffline = useAppStore((s) => s.setOffline)
  const setSaveStatus = useAppStore((s) => s.setSaveStatus)

  useEffect(() => {
    const apply = () => {
      void (async () => {
        try {
          const health = await endpoints.health()
          setOffline(false)
          if (health.durable) await flushLocalSongsToDatabase()
          await flushQueue()
          setSaveStatus('saved')
        } catch {
          const reachable = await pingHealth()
          setOffline(!reachable)
          if (!reachable) setSaveStatus('failed')
        }
      })()
    }

    const unsub = onConnectionChange((online) => setOffline(!online))
    const iv = window.setInterval(() => {
      void pingHealth()
    }, 30_000)
    const later = window.setTimeout(apply, 4000)
    window.addEventListener('online', apply)
    window.addEventListener('offline', apply)
    return () => {
      unsub()
      window.clearInterval(iv)
      window.clearTimeout(later)
      window.removeEventListener('online', apply)
      window.removeEventListener('offline', apply)
    }
  }, [setOffline, setSaveStatus])
}
