import { Button } from '@a1knla/cakeui'

import OutlineItem from './components/OutlineItem'
import { KIND_LABEL, patchSummary, patchTarget, themeSummary } from './utils'

import { WalTheme } from '../../../theme/types'
import { Selection, patchKey } from '../../vm'

import './index.scss'

interface ThemeOutlineProps {
  className?: string
  theme: WalTheme
  selection: Selection
  editorId: string
  onSelectTheme: () => void
  onSelectPatch: (path: string, index: number) => void
  onAddPatch: () => void
}

export default function ThemeOutline({
  className,
  theme,
  selection,
  editorId,
  onSelectTheme,
  onSelectPatch,
  onAddPatch,
}: ThemeOutlineProps) {
  return (
    <nav className={`theme-outline ${className ?? ''}`} aria-label="主题结构">
      <OutlineItem
        title={theme.name || '未命名主题'}
        detail={themeSummary(theme)}
        selected={selection.type === 'theme'}
        controls={editorId}
        onSelect={onSelectTheme}
      />
      {Object.entries(theme.asarPatches).map(([path, patches], group) => (
        <div className="theme-outline-group" key={path}>
          <p className="theme-outline-archive wal-copyable" id={`theme-outline-archive-${group}`}>
            {path}
          </p>
          <ul className="theme-outline-patches" aria-labelledby={`theme-outline-archive-${group}`}>
            {patches.map((patch, index) => {
              const target = patchTarget(patch).trim()
              const missing = patch.kind === 'main-script' ? '未填写页面目录' : '未填写文件路径'
              return (
                <li key={patchKey(path, index)}>
                  <OutlineItem
                    title={target || missing}
                    detail={`${KIND_LABEL[patch.kind]} · ${patchSummary(patch)}`}
                    invalid={!target}
                    selected={selection.type === 'patch' && selection.path === path && selection.index === index}
                    controls={editorId}
                    onSelect={() => onSelectPatch(path, index)}
                  />
                </li>
              )
            })}
          </ul>
        </div>
      ))}
      <Button variant="ghost" className="theme-outline-add" onClick={onAddPatch}>
        <PlusIcon />
        添加补丁
      </Button>
    </nav>
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
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M8 3v10M3 8h10" />
    </svg>
  )
}
