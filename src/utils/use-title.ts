import { useEffect, useState } from 'react'
import { getAppVersion } from '../ports/bridge'
import { useLarkRunning } from './use-lark-running'
import { useLogsStore } from '../store/logs'

export function useWindowTitle() {
  const [appVersion, setAppVersion] = useState<string | null>(null)
  const larkRunning = useLarkRunning()
  const [windowTitle, setWindowTitle] = useState<string | null>(null)

  useEffect(() => {
    getAppVersion().then((version) => {
      setAppVersion(version)
      useLogsStore.getState().add(`当前版本: ${version}`)
    })
  }, [])

  useEffect(() => {
    setWindowTitle(makeTitle(appVersion, larkRunning))
  }, [appVersion, larkRunning])

  return windowTitle
}

function makeTitle(appVersion: string | null, larkRunning: boolean) {
  if (!appVersion) {
    return 'WalAssistantLark'
  }
  if (!larkRunning) {
    return `WalAssistantLark - v${appVersion}`
  }
  return `WalAssistantLark - v${appVersion} - 飞书正在运行`
}
