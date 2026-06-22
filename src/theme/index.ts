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
