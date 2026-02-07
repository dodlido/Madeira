import { useEffect, useState } from 'react'

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initialValue
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state))
      // notify other hook instances in the same window
      try { window.dispatchEvent(new Event('local-storage')) } catch {}
    } catch {}
  }, [key, state])

  useEffect(() => {
    function handler() {
      try {
        const raw = localStorage.getItem(key)
        const parsed = raw ? (JSON.parse(raw) as T) : initialValue
        // update only if different
        setState(prev => {
          try {
            const prevStr = JSON.stringify(prev)
            const parsedStr = JSON.stringify(parsed)
            if (prevStr === parsedStr) return prev
          } catch {}
          return parsed
        })
      } catch {}
    }
    window.addEventListener('local-storage', handler)
    return () => window.removeEventListener('local-storage', handler)
  }, [key, initialValue])

  return [state, setState] as const
}
