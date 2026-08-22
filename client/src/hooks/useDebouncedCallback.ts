import { useEffect, useRef } from 'react'

export function useDebouncedCallback<Args extends unknown[]>(
  fn: (...args: Args) => void,
  ms: number,
): (...args: Args) => void {
  const fnRef = useRef(fn)
  fnRef.current = fn
  const t = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (t.current) clearTimeout(t.current)
    }
  }, [])

  return (...args: Args) => {
    if (t.current) clearTimeout(t.current)
    t.current = setTimeout(() => fnRef.current(...args), ms)
  }
}
