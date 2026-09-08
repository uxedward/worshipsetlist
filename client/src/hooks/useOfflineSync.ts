import { useEffect } from 'react'
import { flushQueue, isOnline, onConnectionChange, pingHealth } from '../lib/api.ts'
import { flushLocalSongsToDatabase } from './useQueries.ts'
import { useAppStore } from '../store/useAppStore.ts'

async function flushPending() {
  await flushLocalSongsToDatabase()
  await flushQueue()
}

export function useOfflineSync() {
  const setOffline = useAppStore((s) => s.setOffline)
  const setSaveStatus = useAppStore((s) => s.setSaveStatus)

  useEffect(() => {
    const syncPending = async () => {
      try {
        await flushPending()
        setSaveStatus('saved')
      } catch {
        // Leftover local songs / queued edits failed to sync. The API may still
        // be reachable — do not flip the offline banner for a flush error.
        setSaveStatus('failed')
      }
    }

    const apply = () => {
      void (async () => {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          setOffline(true)
          setSaveStatus('failed')
          return
        }
        const reachable = await pingHealth()
        if (!reachable && !isOnline()) {
          setOffline(true)
          setSaveStatus('failed')
          return
        }
        setOffline(false)
        await syncPending()
      })()
    }

    const unsub = onConnectionChange((online) => setOffline(!online))
    const iv = window.setInterval(() => {
      void pingHealth()
    }, 30_000)
    // Flush leftover local edits after boot. Do not ping /api/health here —
    // that endpoint hits Postgres, and a single 503 was showing the
    // "Can't reach the Setflow API" banner even after bootstrap succeeded.
    const later = window.setTimeout(() => {
      void syncPending()
    }, 4000)
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
