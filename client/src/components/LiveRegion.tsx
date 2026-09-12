import { useEffect, useState } from 'react'
import { setLiveAnnouncer } from '../lib/announce.ts'

export function LiveRegion() {
  const [message, setMessage] = useState('')
  useEffect(() => {
    setLiveAnnouncer(setMessage)
    return () => setLiveAnnouncer(null)
  }, [])
  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  )
}
