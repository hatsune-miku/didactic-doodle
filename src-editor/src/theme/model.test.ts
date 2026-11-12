import { describe, expect, it } from 'vitest'

import {
  createHistory,
  createPatch,
  createTheme,
  historyReducer,
  readTheme,
  removePatch,
  updatePatch,
  writeTheme,
} from './model'

describe('editor model', () => {
  it('undoes and redoes changes without mutating previous states', () => {
    const initial = createHistory()
    const updated = historyReducer(initial, { type: 'update', update: (theme) => ({ ...theme, name: '示例' }) })
    const undone = historyReducer(updated, { type: 'undo' })
    expect(undone.present).toEqual(initial.present)
    expect(historyReducer(undone, { type: 'redo' }).present.name).toBe('示例')
    expect(initial.present.name).toBe('')
    expect(historyReducer(undone, { type: 'update', update: (theme) => ({ ...theme, id: 'new' }) }).future).toEqual([])
  })
  it('preserves styles and other patches while editing one target', () => {
    const theme = {
      ...createTheme(),
      asarPatches: { 'webcontent/main.asar': [createPatch('main-script'), createPatch('file')] },
    }
    const changed = updatePatch(theme, 'webcontent/main.asar', 0, (patch) => ({ ...patch, customScript: 'test()' }))
    expect(changed.asarPatches['webcontent/main.asar'][0].customScript).toBe('test()')
    expect(changed.asarPatches['webcontent/main.asar'][1]).toBe(theme.asarPatches['webcontent/main.asar'][1])
    expect(theme.asarPatches['webcontent/main.asar'][0].customScript).toBeUndefined()
  })
  it('removes the archive key only when its last patch is removed', () => {
    const theme = { ...createTheme(), asarPatches: { 'a.asar': [createPatch('file'), createPatch('file')] } }
    const first = removePatch(theme, 'a.asar', 0)
    expect(first.asarPatches['a.asar']).toHaveLength(1)
    expect(removePatch(first, 'a.asar', 0).asarPatches).toEqual({})
    expect(theme.asarPatches['a.asar']).toHaveLength(2)
  })
  it('round-trips a Unicode theme with style, color and custom script content', () => {
    const patch = {
      ...createPatch('main-script'),
      styleOverridesBySelector: { '.message': { color: '#ffffff' } },
      colorOverrides: { primaryText: '#123456' },
      customScript: 'console.log("主题")',
    }
    const theme = { ...createTheme(), name: '中文主题', asarPatches: { 'webcontent/messenger.asar': [patch] } }
    expect(readTheme(writeTheme(theme))).toEqual(theme)
  })
  it('reports the location of malformed patch values', () => {
    expect(() => readTheme('asarPatches:\n  a.asar:\n    - kind: file\n      path: 42')).toThrow(
      'a.asar 的第 1 个补丁的 path'
    )
    expect(() => readTheme('asarPatches: []')).toThrow('asarPatches')
  })
})
