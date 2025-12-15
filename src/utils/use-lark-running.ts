import { useEffect, useRef, useState } from 'react'
import { nativeBridge } from '../ports/bridge'

export function useLarkRunning() {
  const [larkRunning, setLarkRunning] = useState<boolean>(false)
  const checkRunningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    nativeBridge.isLarkRunning().then(setLarkRunning)

    const checkProc = () => {
      nativeBridge.isLarkRunning().then((running) => {
        if (!running) {
          checkRunningTimerRef.current = setTimeout(checkProc, 1000)
          return
        }
        setLarkRunning(true)
        nativeBridge
          .waitUntilLarkEnded()
          .then(() => {
            setLarkRunning(false)
            checkRunningTimerRef.current = setTimeout(checkProc, 1000)
          })
          .catch(() => {
            setLarkRunning(false)
            checkRunningTimerRef.current = setTimeout(checkProc, 1000)
          })
      })
    }
    checkProc()
    return () => {
      if (checkRunningTimerRef.current) {
        clearTimeout(checkRunningTimerRef.current)
        checkRunningTimerRef.current = null
      }
    }
  }, [])

  return larkRunning
}
