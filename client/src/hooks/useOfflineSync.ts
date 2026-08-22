import { useEffect } from 'react'
import { onConnectionChange, pingHealth, flushQueue } from '../lib/api.ts'
import { useAppStore } from '../store/useAppStore.ts'
import { useQueryClient } from '@tanstack/react-query'

export function useOfflineSync() {
  const setOffline = useAppStore((s) => s.setOffline)
  const setSaveStatus = useAppStore((s) => s.setSaveStatus)
  const qc = useQueryClient()

  useEffect(() => {
    const unsub = onConnectionChange((online) => {
      setOffline(!online)
      if (online) {
        void (async () => {
          try {
            await flushQueue()
            setSaveStatus('saved')
            await qc.invalidateQueries()
          } catch {
            setSaveStatus('failed')
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
            await qc.invalidateQueries()
          } catch {
            setSaveStatus('failed')
          }
        }
      })
    }, 30_000)
    return () => {
      unsub()
      window.clearInterval(iv)
    }
  }, [qc, setOffline, setSaveStatus])
}
