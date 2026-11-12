import { useEffect, useState } from 'react'

import { nativeBridge } from '../ports/bridge'

export function useLarkRunning() {
  const [running, setRunning] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let disposed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    async function checkRunning() {
      try {
        const next = await nativeBridge.isLarkRunning()
        if (!disposed) {
          setRunning(next)
          setError(null)
        }
      } catch (error) {
        if (!disposed) {
          setRunning(null)
          setError(String(error))
        }
      } finally {
        if (!disposed) timer = setTimeout(checkRunning, 2000)
      }
    }
    checkRunning()
    return () => {
      disposed = true
      if (timer) clearTimeout(timer)
    }
  }, [])
  return { running, error }
}
