import yaml from 'js-yaml'

import { WalAsarPatch, WalTheme } from './types'

export function createTheme(): WalTheme {
  return { asarPatches: {} }
}

export function createPatch(kind: WalAsarPatch['kind']): WalAsarPatch {
  const base = { styleOverridesBySelector: {}, colorOverrides: {}, enableDevTools: false }
  return kind === 'main-script' ? { kind, subject: '', ...base } : { kind, path: '', ...base }
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

const META_FIELDS = ['id', 'name', 'author', 'description'] as const

function orderPatch(patch: WalAsarPatch) {
  return {
    kind: patch.kind,
    ...(patch.kind === 'main-script' ? { subject: patch.subject } : { path: patch.path }),
    ...(patch.description ? { description: patch.description } : {}),
    styleOverridesBySelector: patch.styleOverridesBySelector,
    colorOverrides: patch.colorOverrides,
    enableDevTools: patch.enableDevTools,
    ...(patch.customScript ? { customScript: patch.customScript } : {}),
  }
}

/** 按固定顺序输出字段，省略空的可选文本；读取方把缺省与空文本同等对待。 */
export function writeTheme(theme: WalTheme): string {
  const output = {
    ...Object.fromEntries(META_FIELDS.filter((field) => theme[field]).map((field) => [field, theme[field]])),
    asarPatches: Object.fromEntries(
      Object.entries(theme.asarPatches).map(([path, patches]) => [path, patches.map(orderPatch)])
    ),
  }
  return yaml.dump(output, { noRefs: true, lineWidth: 120 })
}

export function updatePatch(
  theme: WalTheme,
  path: string,
  index: number,
  update: (patch: WalAsarPatch) => WalAsarPatch
): WalTheme {
  const patches = theme.asarPatches[path]
  const current = patches?.[index]
  if (!current) return theme
  const next = update(current)
  if (next === current) return theme
  return {
    ...theme,
    asarPatches: {
      ...theme.asarPatches,
      [path]: patches.map((patch, position) => (position === index ? next : patch)),
    },
  }
}

export function addPatch(theme: WalTheme, path: string, patch: WalAsarPatch): WalTheme {
  return { ...theme, asarPatches: { ...theme.asarPatches, [path]: [...(theme.asarPatches[path] ?? []), patch] } }
}

export function removePatch(theme: WalTheme, path: string, index: number): WalTheme {
  const asarPatches = { ...theme.asarPatches }
  const patches = asarPatches[path]?.filter((_, position) => position !== index)
  if (!patches) return theme
  if (patches.length) asarPatches[path] = patches
  else delete asarPatches[path]
  return { ...theme, asarPatches }
}

/** 把补丁移到另一个 ASAR 包的末尾；原包没有补丁后一并删除。 */
export function movePatch(theme: WalTheme, path: string, index: number, toPath: string): WalTheme {
  const patch = theme.asarPatches[path]?.[index]
  if (!patch || path === toPath) return theme
  return addPatch(removePatch(theme, path, index), toPath, patch)
}

/** 重命名键并保持原有顺序；目标键已存在时由调用方先行拒绝。 */
export function renameKey<T>(record: Record<string, T>, from: string, to: string): Record<string, T> {
  if (from === to || !Object.hasOwn(record, from)) return record
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key === from ? to : key, value]))
}

export interface ThemeHistory {
  past: WalTheme[]
  present: WalTheme
  future: WalTheme[]
  /** 连续输入同一字段时合并为一步撤销。 */
  mergeKey?: string
}
export type ThemeHistoryAction =
  { type: 'update'; update: (theme: WalTheme) => WalTheme; merge?: string } | { type: 'undo' | 'redo' | 'checkpoint' }
export function createHistory(present: WalTheme = createTheme()): ThemeHistory {
  return { past: [], present, future: [] }
}
export function historyReducer(state: ThemeHistory, action: ThemeHistoryAction): ThemeHistory {
  if (action.type === 'checkpoint') return state.mergeKey ? { ...state, mergeKey: undefined } : state
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
  if (next === state.present) return state
  if (action.merge && action.merge === state.mergeKey) return { ...state, present: next }
  return { past: [...state.past.slice(-99), state.present], present: next, future: [], mergeKey: action.merge }
}
