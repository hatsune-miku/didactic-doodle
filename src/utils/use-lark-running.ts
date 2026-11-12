import { useCallback, useEffect, useRef, useState } from 'react'

import { nativeBridge } from '../ports/bridge'

const POLL_INTERVAL = 2000

/** 轮询飞书进程状态。refresh 立即重新读取一次，用于启动或退出飞书之后。 */
export function useLarkRunning() {
  const [running, setRunning] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const checkRef = useRef<() => void>(() => {})

  useEffect(() => {
    let disposed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    async function checkRunning() {
      if (timer) clearTimeout(timer)
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
        // refresh 可能与轮询并发，始终只保留一个待执行的计时器。
        if (timer) clearTimeout(timer)
        if (!disposed) timer = setTimeout(checkRunning, POLL_INTERVAL)
      }
    }
    checkRef.current = checkRunning
    checkRunning()
    return () => {
      disposed = true
      if (timer) clearTimeout(timer)
    }
  }, [])

  const refresh = useCallback(() => checkRef.current(), [])
  return { running, error, refresh }
}
