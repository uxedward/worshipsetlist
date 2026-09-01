import { useEffect } from 'react'
import { onConnectionChange, pingHealth, flushQueue, syncBrowserConnection } from '../lib/api.ts'
import { useAppStore } from '../store/useAppStore.ts'

export function useOfflineSync() {
  const setOffline = useAppStore((s) => s.setOffline)
  const setSaveStatus = useAppStore((s) => s.setSaveStatus)

  useEffect(() => {
    const apply = () => {
      const online = syncBrowserConnection()
      setOffline(!online)
      if (!online) return
      void (async () => {
        try {
          await flushQueue()
          setSaveStatus('saved')
        } catch {
          setSaveStatus('saved')
        }
      })()
    }

    apply()
    window.addEventListener('online', apply)
    window.addEventListener('offline', apply)
    const unsub = onConnectionChange((online) => setOffline(!online))
    const iv = window.setInterval(() => {
      void pingHealth()
    }, 30_000)
    return () => {
      unsub()
      window.clearInterval(iv)
      window.removeEventListener('online', apply)
      window.removeEventListener('offline', apply)
    }
  }, [setOffline, setSaveStatus])
}
