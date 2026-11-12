import { describe, expect, it } from 'vitest'

import {
  addPatch,
  createHistory,
  createPatch,
  createTheme,
  historyReducer,
  movePatch,
  readTheme,
  removePatch,
  renameKey,
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
    expect(initial.present.name).toBeUndefined()
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
  it('merges consecutive edits of one field into a single undo step', () => {
    let state = createHistory()
    for (const name of ['樱', '樱花', '樱花粉'])
      state = historyReducer(state, { type: 'update', update: (theme) => ({ ...theme, name }), merge: 'name' })
    expect(state.past).toHaveLength(1)
    state = historyReducer(state, { type: 'checkpoint' })
    state = historyReducer(state, {
      type: 'update',
      update: (theme) => ({ ...theme, name: '樱花粉 2' }),
      merge: 'name',
    })
    expect(state.past).toHaveLength(2)
    state = historyReducer(state, { type: 'update', update: (theme) => ({ ...theme, id: 'sakura' }), merge: 'id' })
    expect(state.past).toHaveLength(3)
    expect(historyReducer(historyReducer(state, { type: 'undo' }), { type: 'undo' }).present.name).toBe('樱花粉')
    expect(historyReducer(state, { type: 'update', update: (theme) => theme, merge: 'id' })).toBe(state)
  })
  it('moves a patch to the end of another archive and drops the emptied one', () => {
    const main = createPatch('main-script')
    const file = createPatch('file')
    const theme = addPatch(addPatch(createTheme(), 'a.asar', main), 'b.asar', file)
    const moved = movePatch(theme, 'a.asar', 0, 'b.asar')
    expect(moved.asarPatches).toEqual({ 'b.asar': [file, main] })
    expect(movePatch(theme, 'a.asar', 0, 'a.asar')).toBe(theme)
    expect(movePatch(theme, 'a.asar', 3, 'b.asar')).toBe(theme)
  })
  it('renames a key while keeping its position', () => {
    const colors = { '--a': '#111', '--b': '#222', '--c': '#333' }
    expect(Object.keys(renameKey(colors, '--b', '--x'))).toEqual(['--a', '--x', '--c'])
    expect(renameKey(colors, '--missing', '--x')).toBe(colors)
  })
  it('writes fields in a stable order and omits empty optional text', () => {
    const patch = { ...createPatch('file'), path: 'dist/index.js', description: '', customScript: '' }
    const theme = addPatch({ ...createTheme(), name: '示例', id: '' }, 'a.asar', patch)
    expect(writeTheme(theme)).toBe(
      'name: 示例\nasarPatches:\n  a.asar:\n    - kind: file\n      path: dist/index.js\n' +
        '      styleOverridesBySelector: {}\n      colorOverrides: {}\n      enableDevTools: false\n'
    )
  })
})
