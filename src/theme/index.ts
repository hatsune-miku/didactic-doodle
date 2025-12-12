import { useLogsStore } from '../store/logs'
import { WalTheme } from './types'
import yaml from 'js-yaml'

export function isWalTheme(theme: unknown): theme is WalTheme {
  if (typeof theme !== 'object' || theme === null) {
    return false
  }

  if (!('asarPatches' in theme)) {
    return false
  }

  const { asarPatches } = theme as { asarPatches?: unknown }
  if (typeof asarPatches !== 'object' || asarPatches === null) {
    return false
  }

  return Object.values(asarPatches).every(
    (patches) =>
      Array.isArray(patches) &&
      patches.every((patch) => patch !== null && typeof patch === 'object' && 'kind' in (patch as object))
  )
}

export function parseTheme(raw: string): WalTheme | null {
  const createLog = useLogsStore.getState().add

  try {
    const theme = yaml.load(raw) as WalTheme
    if (!isWalTheme(theme)) {
      createLog('解析主题失败: 格式不正确')
      return null
    }
    return theme
  } catch (error) {
    createLog(`解析主题失败: ${error}`)
    return null
  }
}

export function promptAndLoadTheme(): Promise<WalTheme | null> {
  return new Promise((resolve) => {
    const file = document.createElement('input')
    file.type = 'file'
    file.accept = '.yaml'
    file.multiple = false
    file.onchange = (event: Event) => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (event: ProgressEvent<FileReader>) => {
          const content = event.target?.result as string
          resolve(parseTheme(content))
        }
        reader.readAsText(file)
      }
    }
    file.click()
  })
}
