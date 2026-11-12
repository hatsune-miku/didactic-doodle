import yaml from 'js-yaml'

import { WalTheme } from './types'

import { useLogsStore } from '../store/logs'

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

export function decodeTheme(raw: string): WalTheme {
  const theme = yaml.load(raw)
  if (!isWalTheme(theme)) throw new Error('主题格式不正确：需要 asarPatches 对象及补丁列表。')
  return theme
}

export function parseTheme(raw: string): WalTheme | null {
  try {
    return decodeTheme(raw)
  } catch (error) {
    useLogsStore.getState().add(`解析主题失败: ${String(error)}`)
    return null
  }
}
