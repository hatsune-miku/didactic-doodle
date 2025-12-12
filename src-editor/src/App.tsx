import { useEffect, useMemo, useRef, useState } from 'react'
import yaml from 'js-yaml'
import type { WalAsarPatch, WalAsarPatchBase, WalAsarPatchFile, WalAsarPatchMainScript, WalTheme } from './theme/types'

function createEmptyBasePatch(): WalAsarPatchBase {
  return {
    styleOverridesBySelector: {},
    colorOverrides: {},
    enableDevTools: false,
    customScript: '',
    description: '',
  }
}

function createEmptyMainScriptPatch(): WalAsarPatchMainScript {
  return {
    ...createEmptyBasePatch(),
    kind: 'main-script',
    subject: '',
  }
}

function createEmptyFilePatch(): WalAsarPatchFile {
  return {
    ...createEmptyBasePatch(),
    kind: 'file',
    path: '',
  }
}

function createEmptyTheme(): WalTheme {
  return {
    asarPatches: {},
  }
}

function isWalTheme(data: unknown): data is WalTheme {
  if (typeof data !== 'object' || data === null) {
    return false
  }
  const anyData = data as { asarPatches?: unknown }
  if (typeof anyData.asarPatches !== 'object' || anyData.asarPatches === null) {
    return false
  }
  return Object.values(anyData.asarPatches).every(
    (patches) =>
      Array.isArray(patches) &&
      patches.every((patch) => patch !== null && typeof patch === 'object' && 'kind' in (patch as object))
  )
}

function isColorLike(value: string): boolean {
  const v = value.trim()
  if (!v) {
    return false
  }
  if (/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v)) {
    return true
  }
  if (/^(rgb|rgba|hsl|hsla)\(/i.test(v)) {
    return true
  }
  const named = [
    'red',
    'green',
    'blue',
    'black',
    'white',
    'pink',
    'gray',
    'grey',
    'orange',
    'yellow',
    'purple',
    'cyan',
    'magenta',
    'transparent',
    'darkgray',
    'darkgrey',
    'lightgray',
    'lightgrey',
    'darkblue',
    'darkcyan',
    'darkmagenta',
    'darkred',
    'darkgreen',
  ]
  if (named.includes(v.toLowerCase())) {
    return true
  }
  return false
}

function ColorPreview(props: { value: string }) {
  const { value } = props
  if (!isColorLike(value)) {
    return <span className="color-preview" />
  }
  return <span className="color-preview" style={{ backgroundColor: value }} />
}

function App() {
  const [theme, setTheme] = useState<WalTheme>(() => createEmptyTheme())
  const [parseError, setParseError] = useState<string | null>(null)

  const undoStackRef = useRef<WalTheme[]>([])
  const redoStackRef = useRef<WalTheme[]>([])

  function applyThemeUpdate(updater: (prev: WalTheme) => WalTheme, recordHistory: boolean = true) {
    setTheme((prev) => {
      const next = updater(prev)
      if (recordHistory && next !== prev) {
        undoStackRef.current = [...undoStackRef.current, prev]
        redoStackRef.current = []
      }
      return next
    })
  }

  function handleUndo() {
    const undoStack = undoStackRef.current
    if (undoStack.length === 0) {
      return
    }
    const last = undoStack[undoStack.length - 1]
    undoStackRef.current = undoStack.slice(0, -1)
    setTheme((prev) => {
      redoStackRef.current = [...redoStackRef.current, prev]
      return last
    })
  }

  function handleRedo() {
    const redoStack = redoStackRef.current
    if (redoStack.length === 0) {
      return
    }
    const last = redoStack[redoStack.length - 1]
    redoStackRef.current = redoStack.slice(0, -1)
    setTheme((prev) => {
      undoStackRef.current = [...undoStackRef.current, prev]
      return last
    })
  }

  const yamlOutput = useMemo(() => {
    try {
      return yaml.dump(theme, { noRefs: true, lineWidth: 120 })
    } catch {
      return ''
    }
  }, [theme])

  function handleDownloadYaml() {
    const content = yamlOutput
    if (!content.trim()) {
      return
    }
    const blob = new Blob([content], { type: 'text/yaml;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'wal-theme.yaml'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleNewTheme() {
    applyThemeUpdate(() => createEmptyTheme(), true)
    setParseError(null)
  }

  function handleImportYamlFromFile() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.yaml,.yml,text/yaml'
    input.onchange = (event: Event) => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (!file) {
        return
      }
      const reader = new FileReader()
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const content = e.target?.result
        if (typeof content !== 'string') {
          return
        }
        try {
          const data = yaml.load(content)
          if (!isWalTheme(data)) {
            setParseError('YAML 格式不符合 WalTheme 结构')
            return
          }
          applyThemeUpdate(() => data, true)
          setParseError(null)
        } catch (error) {
          setParseError(String(error))
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!event.ctrlKey && !event.metaKey) {
        return
      }
      const key = event.key.toLowerCase()
      if (key === 'z') {
        event.preventDefault()
        handleUndo()
      } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault()
        handleRedo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  function handleAddPatch(kind: WalAsarPatch['kind']) {
    const asarPath = window.prompt('输入 asar 路径（作为键，例如 webcontent/messenger-next.asar）')
    if (!asarPath) {
      return
    }
    applyThemeUpdate((prev) => {
      const patch: WalAsarPatch = kind === 'main-script' ? createEmptyMainScriptPatch() : createEmptyFilePatch()
      const existing = prev.asarPatches[asarPath] || []
      return {
        ...prev,
        asarPatches: {
          ...prev.asarPatches,
          [asarPath]: [...existing, patch],
        },
      }
    })
  }

  function handleRemovePatch(asarPath: string, patchIndex: number) {
    applyThemeUpdate((prev) => {
      const current = prev.asarPatches[asarPath]
      if (!current) {
        return prev
      }
      const nextList = current.filter((_, index) => index !== patchIndex)
      const nextAsarPatches = { ...prev.asarPatches }
      if (nextList.length === 0) {
        delete nextAsarPatches[asarPath]
      } else {
        nextAsarPatches[asarPath] = nextList
      }
      return {
        ...prev,
        asarPatches: nextAsarPatches,
      }
    })
  }

  function updatePatch(
    asarPath: string,
    patchIndex: number,
    updater: (patch: WalAsarPatch) => WalAsarPatch,
    recordHistory: boolean = true
  ) {
    applyThemeUpdate((prev) => {
      const list = prev.asarPatches[asarPath]
      if (!list || !list[patchIndex]) {
        return prev
      }
      const nextList = list.map((patch, index) => (index === patchIndex ? updater(patch) : patch))
      return {
        ...prev,
        asarPatches: {
          ...prev.asarPatches,
          [asarPath]: nextList,
        },
      }
    }, recordHistory)
  }

  function handleToggleDevTools(asarPath: string, patchIndex: number, enable: boolean) {
    updatePatch(
      asarPath,
      patchIndex,
      (patch) => ({
        ...patch,
        enableDevTools: enable,
      }),
      true
    )
  }

  function handleChangeKind(asarPath: string, patchIndex: number, kind: WalAsarPatch['kind']) {
    updatePatch(
      asarPath,
      patchIndex,
      (patch) => {
        const base: WalAsarPatchBase = {
          styleOverridesBySelector: patch.styleOverridesBySelector,
          colorOverrides: patch.colorOverrides,
          enableDevTools: patch.enableDevTools,
          customScript: patch.customScript || '',
          description: patch.description || '',
        }
        if (kind === 'main-script') {
          const next: WalAsarPatchMainScript = {
            ...base,
            kind: 'main-script',
            subject: '',
          }
          return next
        }
        const next: WalAsarPatchFile = {
          ...base,
          kind: 'file',
          path: '',
        }
        return next
      },
      true
    )
  }

  function handleChangeSubject(asarPath: string, patchIndex: number, subject: string) {
    updatePatch(
      asarPath,
      patchIndex,
      (patch) => {
        if (patch.kind !== 'main-script') {
          return patch
        }
        return {
          ...patch,
          subject,
        }
      },
      false
    )
  }

  function handleChangeFilePath(asarPath: string, patchIndex: number, path: string) {
    updatePatch(
      asarPath,
      patchIndex,
      (patch) => {
        if (patch.kind !== 'file') {
          return patch
        }
        return {
          ...patch,
          path,
        }
      },
      false
    )
  }

  function handleChangeDescription(asarPath: string, patchIndex: number, description: string) {
    updatePatch(
      asarPath,
      patchIndex,
      (patch) => ({
        ...patch,
        description,
      }),
      false
    )
  }

  function handleChangeCustomScript(asarPath: string, patchIndex: number, customScript: string) {
    updatePatch(
      asarPath,
      patchIndex,
      (patch) => ({
        ...patch,
        customScript,
      }),
      false
    )
  }

  function handleAddSelector(asarPath: string, patchIndex: number) {
    const selector = window.prompt('输入选择器，例如 .msg-container') || ''
    const trimmed = selector.trim()
    if (!trimmed) {
      return
    }
    updatePatch(
      asarPath,
      patchIndex,
      (patch) => {
        if (patch.styleOverridesBySelector[trimmed]) {
          return patch
        }
        return {
          ...patch,
          styleOverridesBySelector: {
            ...patch.styleOverridesBySelector,
            [trimmed]: {},
          },
        }
      },
      true
    )
  }

  function handleRemoveSelector(asarPath: string, patchIndex: number, selector: string) {
    updatePatch(
      asarPath,
      patchIndex,
      (patch) => {
        const nextSelectors = { ...patch.styleOverridesBySelector }
        delete nextSelectors[selector]
        return {
          ...patch,
          styleOverridesBySelector: nextSelectors,
        }
      },
      true
    )
  }

  function handleChangeDeclaration(
    asarPath: string,
    patchIndex: number,
    selector: string,
    prop: string,
    value: string
  ) {
    updatePatch(
      asarPath,
      patchIndex,
      (patch) => {
        const currentSelector = patch.styleOverridesBySelector[selector] || {}
        const nextSelector = {
          ...currentSelector,
          [prop]: value,
        }
        return {
          ...patch,
          styleOverridesBySelector: {
            ...patch.styleOverridesBySelector,
            [selector]: nextSelector,
          },
        }
      },
      false
    )
  }

  function handleAddDeclaration(asarPath: string, patchIndex: number, selector: string) {
    const prop = window.prompt('输入 CSS 属性名，例如 color') || ''
    const trimmed = prop.trim()
    if (!trimmed) {
      return
    }
    handleChangeDeclaration(asarPath, patchIndex, selector, trimmed, '')
  }

  function handleRemoveDeclaration(asarPath: string, patchIndex: number, selector: string, prop: string) {
    updatePatch(
      asarPath,
      patchIndex,
      (patch) => {
        const currentSelector = patch.styleOverridesBySelector[selector]
        if (!currentSelector) {
          return patch
        }
        const nextSelector = { ...currentSelector }
        delete nextSelector[prop]
        return {
          ...patch,
          styleOverridesBySelector: {
            ...patch.styleOverridesBySelector,
            [selector]: nextSelector,
          },
        }
      },
      true
    )
  }

  function handleChangeColorOverride(asarPath: string, patchIndex: number, key: string, value: string) {
    updatePatch(
      asarPath,
      patchIndex,
      (patch) => ({
        ...patch,
        colorOverrides: {
          ...patch.colorOverrides,
          [key]: value,
        },
      }),
      false
    )
  }

  function handleAddColorOverride(asarPath: string, patchIndex: number) {
    const key = window.prompt('输入颜色 key，例如 primaryText') || ''
    const trimmed = key.trim()
    if (!trimmed) {
      return
    }
    updatePatch(
      asarPath,
      patchIndex,
      (patch) => {
        if (patch.colorOverrides[trimmed]) {
          return patch
        }
        return {
          ...patch,
          colorOverrides: {
            ...patch.colorOverrides,
            [trimmed]: '',
          },
        }
      },
      true
    )
  }

  function handleRemoveColorOverride(asarPath: string, patchIndex: number, key: string) {
    updatePatch(
      asarPath,
      patchIndex,
      (patch) => {
        const next = { ...patch.colorOverrides }
        delete next[key]
        return {
          ...patch,
          colorOverrides: next,
        }
      },
      true
    )
  }

  const asarEntries = Object.entries(theme.asarPatches)
  const patchCount = asarEntries.reduce((sum, [, list]) => sum + list.length, 0)

  return (
    <div className="app-root">
      <div className="editor-panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="section-title">Wal 主题编辑器（无敌的gpt5写的）</div>
            <div className="muted">在左侧编辑结构，在右侧查看 / 拷贝 YAML</div>
          </div>
          <div>
            <button className="button button-ghost" onClick={handleNewTheme}>
              新建主题
            </button>
            <button className="button button-primary" style={{ marginLeft: 8 }} onClick={handleImportYamlFromFile}>
              从 YAML 文件导入
            </button>
          </div>
        </div>

        {parseError ? <div className="error">解析失败: {parseError}</div> : null}

        <div className="row" style={{ justifyContent: 'flex-start' }}>
          <span className="field-label">asar 补丁</span>
          <button className="button" onClick={() => handleAddPatch('main-script')} style={{ maxWidth: 140 }}>
            新建主脚本补丁
          </button>
          <button className="button" onClick={() => handleAddPatch('file')} style={{ maxWidth: 140 }}>
            新建文件补丁
          </button>
        </div>

        {patchCount === 0 ? (
          <div className="muted">当前主题还没有任何 asar 补丁。</div>
        ) : (
          asarEntries.map(([asarPath, patchList]) => (
            <div key={asarPath} className="patch-card">
              <div className="row" style={{ marginBottom: 4 }}>
                <div style={{ flex: 3 }}>
                  <div className="field-label">asar 路径</div>
                  <div className="muted" style={{ wordBreak: 'break-all' }}>
                    {asarPath}
                  </div>
                </div>
                <div style={{ flex: 2, textAlign: 'right' }}>
                  <span className="badge">补丁数: {patchList.length}</span>
                </div>
              </div>

              {patchList.map((patch, patchIndex) => {
                const selectors = Object.keys(patch.styleOverridesBySelector || {})
                const colorKeys = Object.keys(patch.colorOverrides || {})
                return (
                  <div key={`${asarPath}-${patchIndex}`} className="patch-card" style={{ marginTop: 8 }}>
                    <div className="row" style={{ marginBottom: 4 }}>
                      <div style={{ flex: 3 }}>
                        <div className="field-label">补丁 {patchIndex + 1}</div>
                        <div className="muted">类型: {patch.kind === 'main-script' ? '主脚本' : '文件'}</div>
                      </div>
                      <div style={{ flex: 2, textAlign: 'right' }}>
                        <span className="badge">样式: {selectors.length}</span>
                        <span className="badge" style={{ marginLeft: 4 }}>
                          颜色: {colorKeys.length}
                        </span>
                      </div>
                    </div>

                    <div className="row" style={{ marginBottom: 4 }}>
                      <div>
                        <div className="field-label">补丁类型</div>
                        <select
                          className="field-input"
                          value={patch.kind}
                          onChange={(e) =>
                            handleChangeKind(asarPath, patchIndex, e.target.value as WalAsarPatch['kind'])
                          }
                        >
                          <option value="main-script">主脚本</option>
                          <option value="file">文件</option>
                        </select>
                      </div>
                      <div>
                        <div className="field-label">{patch.kind === 'main-script' ? 'Subject' : '文件内部路径'}</div>
                        <input
                          className="field-input"
                          value={patch.kind === 'main-script' ? patch.subject : patch.path}
                          onChange={(e) =>
                            patch.kind === 'main-script'
                              ? handleChangeSubject(asarPath, patchIndex, e.target.value)
                              : handleChangeFilePath(asarPath, patchIndex, e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <div className="field-label">启用 DevTools</div>
                        <label className="row" style={{ alignItems: 'center', gap: 4 }}>
                          <input
                            type="checkbox"
                            checked={patch.enableDevTools}
                            onChange={(e) => handleToggleDevTools(asarPath, patchIndex, e.target.checked)}
                          />
                          <span style={{ fontSize: 12 }}>启用</span>
                        </label>
                      </div>
                    </div>

                    <div className="row" style={{ marginBottom: 4 }}>
                      <div style={{ flex: 1 }}>
                        <div className="field-label">描述</div>
                        <input
                          className="field-input"
                          value={patch.description || ''}
                          onChange={(e) => handleChangeDescription(asarPath, patchIndex, e.target.value)}
                        />
                      </div>
                    </div>

                    <div style={{ marginBottom: 8 }}>
                      <div className="field-label">自定义脚本</div>
                      <textarea
                        className="field-input"
                        style={{ minHeight: 80 }}
                        value={patch.customScript || ''}
                        onChange={(e) => handleChangeCustomScript(asarPath, patchIndex, e.target.value)}
                      />
                    </div>

                    <div style={{ marginTop: 8 }}>
                      <div className="section-title">样式覆盖</div>
                      {selectors.length === 0 ? (
                        <div className="muted" style={{ marginTop: 4 }}>
                          暂无样式覆盖。
                        </div>
                      ) : null}
                      {selectors.map((selector) => {
                        const declarations = patch.styleOverridesBySelector[selector] || {}
                        const props = Object.entries(declarations)
                        return (
                          <div key={`${selector}-${patchIndex}`} style={{ marginTop: 6 }}>
                            <div className="row" style={{ marginBottom: 4 }}>
                              <div className="field-label" style={{ flex: 1.5 }}>
                                选择器
                              </div>
                              <div className="muted" style={{ flex: 3 }}>
                                {selector}
                              </div>
                              <div style={{ flex: 1, textAlign: 'right' }}>
                                <button
                                  className="button"
                                  onClick={() => handleRemoveSelector(asarPath, patchIndex, selector)}
                                >
                                  删除选择器
                                </button>
                              </div>
                            </div>
                            {props.length === 0 ? <div className="muted">暂无属性。</div> : null}
                            {props.map(([prop, value]) => (
                              <div key={`${prop}-${patchIndex}`} className="row" style={{ marginBottom: 4 }}>
                                <input className="field-input" style={{ flex: 1.2 }} value={prop} readOnly />
                                <input
                                  className="field-input"
                                  style={{ flex: 2 }}
                                  value={value}
                                  onChange={(e) =>
                                    handleChangeDeclaration(asarPath, patchIndex, selector, prop, e.target.value)
                                  }
                                />
                                <button
                                  className="button"
                                  onClick={() => handleRemoveDeclaration(asarPath, patchIndex, selector, prop)}
                                >
                                  删除
                                </button>
                              </div>
                            ))}
                            <button
                              className="button"
                              style={{ marginTop: 4 }}
                              onClick={() => handleAddDeclaration(asarPath, patchIndex, selector)}
                            >
                              添加属性
                            </button>
                          </div>
                        )
                      })}
                      <button
                        className="button"
                        style={{ marginTop: 6 }}
                        onClick={() => handleAddSelector(asarPath, patchIndex)}
                      >
                        添加选择器
                      </button>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <div className="section-title">颜色覆盖</div>
                      {colorKeys.length === 0 ? (
                        <div className="muted" style={{ marginTop: 4 }}>
                          暂无颜色覆盖。
                        </div>
                      ) : null}
                      {colorKeys.map((key) => (
                        <div key={`${key}-${patchIndex}`} className="row" style={{ marginBottom: 4 }}>
                          <input className="field-input" style={{ flex: 1.2 }} value={key} readOnly />
                          <input
                            className="field-input"
                            style={{ flex: 2 }}
                            value={patch.colorOverrides[key]}
                            onChange={(e) => handleChangeColorOverride(asarPath, patchIndex, key, e.target.value)}
                          />
                          <ColorPreview value={patch.colorOverrides[key]} />
                          <button
                            className="button"
                            onClick={() => handleRemoveColorOverride(asarPath, patchIndex, key)}
                          >
                            删除
                          </button>
                        </div>
                      ))}
                      <button
                        className="button"
                        style={{ marginTop: 6 }}
                        onClick={() => handleAddColorOverride(asarPath, patchIndex)}
                      >
                        添加颜色覆盖
                      </button>
                    </div>

                    <div style={{ marginTop: 12, textAlign: 'right' }}>
                      <button className="button" onClick={() => handleRemovePatch(asarPath, patchIndex)}>
                        删除此补丁
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>

      <div className="yaml-panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="section-title">当前主题 YAML</div>
            <div className="muted">此处为只读预览，可直接全选拷贝或导出 YAML 文件。</div>
          </div>
          <button className="button" onClick={handleDownloadYaml} disabled={!yamlOutput.trim()}>
            导出 YAML
          </button>
        </div>
        <textarea className="yaml-textarea" readOnly value={yamlOutput} />
      </div>
    </div>
  )
}

export default App
