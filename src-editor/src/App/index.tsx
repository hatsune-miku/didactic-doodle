import { useEffect, useMemo, useReducer, useRef, useState } from 'react'

import { Alert, Button, CakeProvider } from '@a1knla/cakeui'

import EntryDialog from './components/EntryDialog'
import MetadataFields from './components/MetadataFields'
import PatchEditor from './components/PatchEditor'
import YamlPreview from './components/YamlPreview'
import { EntryRequest } from './types'

import {
  createHistory,
  createPatch,
  createTheme,
  historyReducer,
  readTheme,
  removePatch,
  updatePatch,
  writeTheme,
} from '../theme/model'
import { WalAsarPatch, WalTheme } from '../theme/types'

import './index.scss'

export default function App() {
  const [history, dispatch] = useReducer(historyReducer, undefined, createHistory)
  const [error, setError] = useState<string | null>(null)
  const [entry, setEntry] = useState<EntryRequest | null>(null)
  const [importing, setImporting] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const theme = history.present
  const yaml = useMemo(() => writeTheme(theme), [theme])

  function changeTheme(update: (theme: WalTheme) => WalTheme) {
    dispatch({ type: 'update', update })
  }
  function changeMeta(field: 'id' | 'name' | 'author' | 'description', value: string) {
    changeTheme((current) => ({ ...current, [field]: value }))
  }
  function handleNew() {
    changeTheme(createTheme)
    setError(null)
  }
  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setImporting(true)
    setError(null)
    try {
      const next = readTheme(await file.text())
      changeTheme(() => next)
    } catch (error) {
      setError(`导入 ${file.name} 失败: ${String(error)}`)
    } finally {
      setImporting(false)
    }
  }
  function handleExport() {
    const url = URL.createObjectURL(new Blob([yaml], { type: 'application/yaml;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${(theme.id || 'wal-theme').replace(/[^\p{L}\p{N}._-]/gu, '-')}.yaml`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  function handleAddPatch(kind: WalAsarPatch['kind']) {
    setEntry({
      title: kind === 'main-script' ? '添加主脚本补丁' : '添加文件补丁',
      label: 'ASAR 路径',
      placeholder: 'webcontent/messenger.asar',
      onSubmit: (path) => {
        if (!path.toLowerCase().endsWith('.asar')) throw new Error('ASAR 路径应以 .asar 结尾。')
        changeTheme((current) => ({
          ...current,
          asarPatches: { ...current.asarPatches, [path]: [...(current.asarPatches[path] || []), createPatch(kind)] },
        }))
      },
    })
  }

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.closest('input, textarea, select, dialog') || target.isContentEditable)
      )
        return
      const key = event.key.toLowerCase()
      if (key === 'z' || key === 'y') {
        event.preventDefault()
        dispatch({ type: key === 'y' || event.shiftKey ? 'redo' : 'undo' })
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  return (
    <CakeProvider accentColor="#e8788a" foreground="light" mode="system" density="compact" className="wal-app">
      <main className="editor-app">
        <header className="editor-toolbar">
          <div className="editor-toolbar-group">
            <Button onClick={handleNew} disabled={importing}>
              新建主题
            </Button>
            <Button onClick={() => fileInput.current?.click()} loading={importing}>
              导入 YAML
            </Button>
            <Button
              variant="ghost"
              disabled={!history.past.length || importing}
              onClick={() => dispatch({ type: 'undo' })}
            >
              撤销
            </Button>
            <Button
              variant="ghost"
              disabled={!history.future.length || importing}
              onClick={() => dispatch({ type: 'redo' })}
            >
              重做
            </Button>
          </div>
          <Button variant="primary" onClick={handleExport}>
            导出 YAML
          </Button>
          <input
            className="editor-file-input"
            ref={fileInput}
            type="file"
            accept=".yaml,.yml,application/yaml,text/yaml"
            onChange={handleImport}
            aria-label="导入主题文件"
            hidden
          />
        </header>
        {error && (
          <Alert tone="danger" className="editor-error">
            <span className="wal-copyable">{error}</span>
            <Button size="small" onClick={() => fileInput.current?.click()}>
              重新选择文件
            </Button>
            <Button size="small" variant="ghost" onClick={() => setError(null)}>
              关闭
            </Button>
          </Alert>
        )}
        <div className="editor-workspace">
          <div className="editor-form">
            <MetadataFields theme={theme} onChange={changeMeta} />
            <div className="editor-add-patch">
              <Button onClick={() => handleAddPatch('main-script')}>添加主脚本补丁</Button>
              <Button variant="ghost" onClick={() => handleAddPatch('file')}>
                添加文件补丁
              </Button>
            </div>
            {Object.keys(theme.asarPatches).length === 0 && <p className="editor-empty">尚未添加补丁</p>}
            {Object.entries(theme.asarPatches).map(([path, patches]) => (
              <section key={path} className="editor-archive" aria-label={path}>
                <h2 className="editor-archive-path wal-copyable">{path}</h2>
                {patches.map((patch, index) => (
                  <PatchEditor
                    key={`${path}-${index}`}
                    patch={patch}
                    index={index}
                    onChange={(update) => changeTheme((current) => updatePatch(current, path, index, update))}
                    onRemove={() => changeTheme((current) => removePatch(current, path, index))}
                    onRequestEntry={setEntry}
                  />
                ))}
              </section>
            ))}
          </div>
          <YamlPreview content={yaml} />
        </div>
      </main>
      {entry && <EntryDialog request={entry} onClose={() => setEntry(null)} />}
    </CakeProvider>
  )
}
