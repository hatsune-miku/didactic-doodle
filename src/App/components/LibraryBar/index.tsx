import { Button, WhatsThis } from '@a1knla/cakeui'

import './index.scss'

interface LibraryBarProps {
  className?: string
  disabled: boolean
  loaded: boolean
  onImport: () => void
  onOpenEditor: () => void
}

export default function LibraryBar({ className, disabled, loaded, onImport, onOpenEditor }: LibraryBarProps) {
  return (
    <div className={`library-bar ${className ?? ''}`}>
      <Button onClick={onImport} disabled={disabled || !loaded}>
        <PlusIcon />
        导入主题
      </Button>
      <Button variant="ghost" onClick={onOpenEditor} disabled={disabled}>
        主题编辑器
        <ExternalIcon />
      </Button>
      <span className="library-bar-help">
        <WhatsThis label="主题顺序说明">
          勾选的主题按列表顺序合并，靠上的优先。拖动左侧手柄或在手柄上按上下方向键调整顺序。
        </WhatsThis>
      </span>
    </div>
  )
}

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M8 3v10M3 8h10" strokeLinecap="round" />
    </svg>
  )
}

function ExternalIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M6 3H3.5v9.5H13V10M9 3h4v4M13 3 7.5 8.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
