import { useRef } from 'react'

import { Button, HoverTips, WhatsThis } from '@a1knla/cakeui'

import './index.scss'

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl+'

interface ToolbarProps {
  className?: string
  canUndo: boolean
  canRedo: boolean
  importing: boolean
  draft: { saved: boolean; error: string | null }
  onNew: () => void
  onImport: (file: File) => void
  onUndo: () => void
  onRedo: () => void
  onExport: () => void
}

export default function Toolbar({
  className,
  canUndo,
  canRedo,
  importing,
  draft,
  onNew,
  onImport,
  onUndo,
  onRedo,
  onExport,
}: ToolbarProps) {
  const fileInput = useRef<HTMLInputElement>(null)

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (file) onImport(file)
  }

  return (
    <div className={`toolbar ${className ?? ''}`}>
      <div className="toolbar-group">
        <Button onClick={onNew} disabled={importing}>
          新建主题
        </Button>
        <Button onClick={() => fileInput.current?.click()} loading={importing}>
          导入 YAML
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".yaml,.yml,application/yaml,text/yaml"
          onChange={handleFile}
          aria-label="选择要导入的主题文件"
          hidden
        />
      </div>
      <div className="toolbar-group">
        <HoverTips content={`撤销 ${MOD}Z`}>
          <Button variant="ghost" className="toolbar-icon" aria-label="撤销" disabled={!canUndo} onClick={onUndo}>
            <UndoIcon />
          </Button>
        </HoverTips>
        <HoverTips content={`重做 ${MOD}Shift+Z`}>
          <Button variant="ghost" className="toolbar-icon" aria-label="重做" disabled={!canRedo} onClick={onRedo}>
            <RedoIcon />
          </Button>
        </HoverTips>
      </div>
      {draft.error ? (
        <span className="toolbar-draft" data-tone="warning">
          草稿无法暂存
          <WhatsThis label="草稿无法暂存的原因">{draft.error}。刷新或关闭页面会丢失修改，请及时导出 YAML。</WhatsThis>
        </span>
      ) : (
        draft.saved && <span className="toolbar-draft">草稿已暂存在此浏览器</span>
      )}
      <HoverTips content={`${MOD}S`} className="toolbar-export">
        <Button variant="primary" onClick={onExport} aria-keyshortcuts="Control+S Meta+S">
          导出 YAML
        </Button>
      </HoverTips>
    </div>
  )
}

function UndoIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5.5 2 2.5 5l3 3M2.5 5h7a4 4 0 0 1 0 8H7" />
    </svg>
  )
}

function RedoIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m10.5 2 3 3-3 3M13.5 5h-7a4 4 0 0 0 0 8H9" />
    </svg>
  )
}
