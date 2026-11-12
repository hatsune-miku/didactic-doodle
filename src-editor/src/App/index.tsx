import { useEffect, useState } from 'react'

import { Alert, Button, CakeProvider, Toast } from '@a1knla/cakeui'

import PatchEditor from './components/PatchEditor'
import ThemeInfo from './components/ThemeInfo'
import ThemeOutline from './components/ThemeOutline'
import Toolbar from './components/Toolbar'
import YamlPreview from './components/YamlPreview'
import { DEFAULT_ARCHIVE, useEditor } from './vm'

import './index.scss'

const PANE_ID = 'editor-pane'
const TARGET_ID = 'editor-patch-target'
/** 提示里带撤销按钮，比默认时长多留些时间去点。 */
const REMOVAL_TOAST_DURATION = 8000

function hasFiles(event: React.DragEvent) {
  return Array.from(event.dataTransfer.types).includes('Files')
}

export default function App() {
  const editor = useEditor()
  const { theme, selection, selectedPatch, focusRequest, handleFocusHandled } = editor
  const [dropping, setDropping] = useState(false)
  const archives = Array.from(new Set([...Object.keys(theme.asarPatches), DEFAULT_ARCHIVE]))

  useEffect(() => {
    if (!focusRequest) return
    const target =
      focusRequest === 'target'
        ? document.getElementById(TARGET_ID)
        : document.querySelector<HTMLElement>('.editor-outline [aria-current="true"]')
    target?.focus()
    handleFocusHandled()
  }, [focusRequest, handleFocusHandled])

  function handleDragOver(event: React.DragEvent) {
    if (!hasFiles(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setDropping(true)
  }

  function handleDragLeave(event: React.DragEvent) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropping(false)
  }

  function handleDrop(event: React.DragEvent) {
    if (!hasFiles(event)) return
    event.preventDefault()
    setDropping(false)
    const file = event.dataTransfer.files[0]
    if (file) editor.handleImport(file)
  }

  return (
    <CakeProvider accentColor="#e8788a" foreground="light" mode="system" density="compact" className="wal-app">
      <main
        className="editor"
        data-dropping={dropping}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <header className="editor-header">
          <Toolbar
            canUndo={editor.canUndo}
            canRedo={editor.canRedo}
            importing={editor.importing}
            draft={editor.draft}
            onNew={editor.handleNew}
            onImport={editor.handleImport}
            onUndo={editor.handleUndo}
            onRedo={editor.handleRedo}
            onExport={editor.handleExport}
          />
          {editor.importError && (
            <Alert tone="danger" className="editor-alert">
              <span className="editor-alert-text wal-copyable">{editor.importError}</span>
              <Button size="small" variant="ghost" onClick={editor.handleDismissImportError}>
                关闭
              </Button>
            </Alert>
          )}
          {editor.brokenDraft && (
            <Alert tone="warning" className="editor-alert">
              <span className="editor-alert-text wal-copyable">
                上次暂存的草稿无法读取：{editor.brokenDraft.error}
                {editor.brokenCopy && `（${editor.brokenCopy}）`}
              </span>
              <Button size="small" onClick={editor.handleCopyBrokenDraft}>
                复制草稿原文
              </Button>
              <Button size="small" variant="ghost" onClick={editor.handleDismissBrokenDraft}>
                关闭
              </Button>
            </Alert>
          )}
        </header>
        <ThemeOutline
          className="editor-outline"
          theme={theme}
          selection={selection}
          editorId={PANE_ID}
          onSelectTheme={editor.handleSelectTheme}
          onSelectPatch={editor.handleSelectPatch}
          onAddPatch={editor.handleAddPatch}
        />
        <section
          className="editor-pane"
          id={PANE_ID}
          aria-label={selection.type === 'patch' ? '编辑补丁' : '编辑主题信息'}
        >
          <div className="editor-pane-content">
            {selection.type === 'patch' && selectedPatch ? (
              <PatchEditor
                key={editor.editorKey}
                path={selection.path}
                patch={selectedPatch}
                archives={archives}
                targetId={TARGET_ID}
                onChange={editor.handleUpdatePatch}
                onCommit={editor.handleCheckpoint}
                onMoveArchive={editor.handleMoveArchive}
                onRemove={editor.handleRemovePatch}
              />
            ) : (
              <ThemeInfo
                theme={theme}
                onChange={editor.handleMeta}
                onCommit={editor.handleCheckpoint}
                onAddPatch={editor.handleAddPatch}
              />
            )}
          </div>
        </section>
        <YamlPreview className="editor-yaml" content={editor.yaml} />
      </main>
      <Toast
        key={editor.removal.serial}
        open={editor.removal.open}
        onOpenChange={(open) => !open && editor.handleCloseRemoval()}
        duration={REMOVAL_TOAST_DURATION}
        tone="neutral"
        closeLabel="关闭"
        className="editor-toast"
      >
        <span className="editor-toast-text">已移除 {editor.removal.label}</span>
        <Button size="small" onClick={editor.handleUndoRemoval}>
          撤销
        </Button>
      </Toast>
    </CakeProvider>
  )
}
