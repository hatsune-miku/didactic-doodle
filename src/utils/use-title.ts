import { useEffect } from 'react'

import { getCurrentWindow } from '@tauri-apps/api/window'

import { getAppVersion } from '../ports/bridge'
import { useLogsStore } from '../store/logs'

export function useWindowTitle() {
  useEffect(() => {
    getAppVersion()
      .then(async (version) => {
        useLogsStore.getState().add(`当前版本: ${version}`)
        await getCurrentWindow().setTitle(`Wal Assistant Lark · ${version}`)
      })
      .catch((error) => useLogsStore.getState().add(`读取版本或设置窗口标题失败: ${String(error)}`))
  }, [])
}
