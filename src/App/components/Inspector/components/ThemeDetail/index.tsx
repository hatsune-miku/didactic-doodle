import { Alert, Button } from '@a1knla/cakeui'

import PatchList from './components/PatchList'

import { LibraryItem, themeDisplayName } from '../../../../../store/theme-library'

import './index.scss'

interface ThemeDetailProps {
  id: string
  item: LibraryItem | null
  loaded: boolean
  disabled: boolean
  first: boolean
  last: boolean
  onMove: (offset: number) => void
  onRemove: () => void
  onReimport: () => void
}

export default function ThemeDetail({
  id,
  item,
  loaded,
  disabled,
  first,
  last,
  onMove,
  onRemove,
  onReimport,
}: ThemeDetailProps) {
  if (!item) {
    return (
      <div id={id} className="theme-detail" data-empty="true">
        <p className="theme-detail-placeholder-text">{loaded ? '导入主题后，在这里查看它修改的内容。' : ''}</p>
      </div>
    )
  }

  const { theme, entry } = item
  const meta = [theme?.author?.trim(), entry.id, entry.fileName].filter((value, index, list) => {
    return value && list.indexOf(value) === index
  })

  return (
    <article id={id} className="theme-detail" aria-label={`${themeDisplayName(item)} 的详情`}>
      <header className="theme-detail-header">
        <h2 className="theme-detail-name wal-copyable">{themeDisplayName(item)}</h2>
        <p className="theme-detail-meta wal-copyable">{meta.join(' · ')}</p>
        {theme?.description?.trim() && <p className="theme-detail-description wal-copyable">{theme.description}</p>}
      </header>
      <div className="theme-detail-actions">
        <Button size="small" variant="ghost" disabled={disabled || first} onClick={() => onMove(-1)}>
          <ArrowIcon direction="up" />
          上移
        </Button>
        <Button size="small" variant="ghost" disabled={disabled || last} onClick={() => onMove(1)}>
          <ArrowIcon direction="down" />
          下移
        </Button>
        <Button size="small" variant="ghost" className="theme-detail-remove" disabled={disabled} onClick={onRemove}>
          移除
        </Button>
      </div>
      {item.parseError && (
        <Alert tone="danger" className="theme-detail-alert">
          <span className="theme-detail-alert-text wal-copyable">{item.error || '无法读取此主题文件。'}</span>
          <Button size="small" onClick={onReimport} disabled={disabled}>
            重新导入
          </Button>
        </Alert>
      )}
      {theme && <PatchList theme={theme} />}
    </article>
  )
}

function ArrowIcon({ direction }: { direction: 'up' | 'down' }) {
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
      <path
        d={direction === 'up' ? 'M8 13V3M4 7l4-4 4 4' : 'M8 3v10M4 9l4 4 4-4'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
