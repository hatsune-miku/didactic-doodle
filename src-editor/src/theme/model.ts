import yaml from 'js-yaml'

import { WalAsarPatch, WalTheme } from './types'

export function createTheme(): WalTheme {
  return { id: '', name: '', author: '', description: '', asarPatches: {} }
}

export function createPatch(kind: WalAsarPatch['kind']): WalAsarPatch {
  const base = { styleOverridesBySelector: {}, colorOverrides: {}, enableDevTools: false }
  return kind === 'main-script' ? { ...base, kind, subject: '' } : { ...base, kind, path: '' }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isStringMap(value: unknown): boolean {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string')
}

export function readTheme(content: string): WalTheme {
  const data: unknown = yaml.load(content)
  if (!isRecord(data) || !isRecord(data.asarPatches)) throw new Error('需要包含 asarPatches 对象的 YAML 主题。')
  for (const field of ['id', 'name', 'author', 'description']) {
    if (data[field] !== undefined && typeof data[field] !== 'string') throw new Error(`${field} 必须是文本。`)
  }
  for (const [path, patches] of Object.entries(data.asarPatches)) {
    if (!Array.isArray(patches)) throw new Error(`${path} 的补丁必须是列表。`)
    patches.forEach((patch: unknown, index: number) => {
      const location = `${path} 的第 ${index + 1} 个补丁`
      if (!isRecord(patch) || !['main-script', 'file'].includes(String(patch.kind)))
        throw new Error(`${location}的 kind 必须是 main-script 或 file。`)
      const target = patch.kind === 'main-script' ? 'subject' : 'path'
      if (typeof patch[target] !== 'string') throw new Error(`${location}的 ${target} 必须是文本。`)
      if (
        !isRecord(patch.styleOverridesBySelector) ||
        !Object.values(patch.styleOverridesBySelector).every(isStringMap)
      )
        throw new Error(`${location}的样式必须是选择器、属性和文本值。`)
      if (!isStringMap(patch.colorOverrides)) throw new Error(`${location}的颜色覆盖必须包含文本值。`)
      if (typeof patch.enableDevTools !== 'boolean') throw new Error(`${location}的 enableDevTools 必须是布尔值。`)
      for (const key of ['customScript', 'description'])
        if (patch[key] !== undefined && typeof patch[key] !== 'string')
          throw new Error(`${location}的 ${key} 必须是文本。`)
    })
  }
  return data as unknown as WalTheme
}

export function writeTheme(theme: WalTheme): string {
  return yaml.dump(theme, { noRefs: true, lineWidth: 120 })
}

export function updatePatch(
  theme: WalTheme,
  path: string,
  index: number,
  update: (patch: WalAsarPatch) => WalAsarPatch
): WalTheme {
  const patches = theme.asarPatches[path]
  if (!patches?.[index]) return theme
  return {
    ...theme,
    asarPatches: {
      ...theme.asarPatches,
      [path]: patches.map((patch, position) => (position === index ? update(patch) : patch)),
    },
  }
}

export function removePatch(theme: WalTheme, path: string, index: number): WalTheme {
  const asarPatches = { ...theme.asarPatches }
  const patches = asarPatches[path]?.filter((_, position) => position !== index)
  if (!patches) return theme
  if (patches.length) asarPatches[path] = patches
  else delete asarPatches[path]
  return { ...theme, asarPatches }
}

export interface ThemeHistory {
  past: WalTheme[]
  present: WalTheme
  future: WalTheme[]
}
export type ThemeHistoryAction = { type: 'update'; update: (theme: WalTheme) => WalTheme } | { type: 'undo' | 'redo' }
export function createHistory(): ThemeHistory {
  return { past: [], present: createTheme(), future: [] }
}
export function historyReducer(state: ThemeHistory, action: ThemeHistoryAction): ThemeHistory {
  if (action.type === 'undo') {
    if (!state.past.length) return state
    return {
      past: state.past.slice(0, -1),
      present: state.past[state.past.length - 1],
      future: [state.present, ...state.future],
    }
  }
  if (action.type === 'redo') {
    if (!state.future.length) return state
    return { past: [...state.past, state.present], present: state.future[0], future: state.future.slice(1) }
  }
  if (action.type !== 'update') return state
  const next = action.update(state.present)
  return next === state.present ? state : { past: [...state.past.slice(-99), state.present], present: next, future: [] }
}
