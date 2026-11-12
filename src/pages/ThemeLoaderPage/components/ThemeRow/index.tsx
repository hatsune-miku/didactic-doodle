import { useId, useState } from 'react'

import { Reorder, useDragControls, useReducedMotion } from 'framer-motion'

import { Button, CheckBox, HoverTips } from '@a1knla/cakeui'

import ThemePatchView from './components/ThemePatchView'

import { LibraryItem, themeDisplayName } from '../../../../store/theme-library'

import './index.scss'

interface ThemeRowProps {
  item: LibraryItem
  disabled: boolean
  first: boolean
  last: boolean
  onToggle: () => void
  onRemove: () => void
  onMove: (offset: number) => void
  onDragEnd: () => void
}

export default function ThemeRow({
  item,
  disabled,
  first,
  last,
  onToggle,
  onRemove,
  onMove,
  onDragEnd,
}: ThemeRowProps) {
  const [expanded, setExpanded] = useState(false)
  const dragControls = useDragControls()
  const reducedMotion = useReducedMotion()
  const detailId = useId()
  const name = themeDisplayName(item)

  return (
    <Reorder.Item
      as="li"
      value={item.entry.id}
      dragListener={false}
      dragControls={dragControls}
      drag={disabled ? false : 'y'}
      onDragEnd={onDragEnd}
      transition={{ duration: reducedMotion ? 0 : 0.15, ease: [0.29, 0, 0, 1] }}
      className="theme-row"
      data-enabled={item.entry.enabled}
    >
      <div className="theme-row-head">
        <HoverTips content="拖动排序，也可使用上下方向键">
          <button
            type="button"
            className="theme-row-drag"
            aria-label={`调整 ${name} 的优先级，使用上下方向键`}
            disabled={disabled}
            onPointerDown={(event) => dragControls.start(event)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                event.preventDefault()
                onMove(event.key === 'ArrowUp' ? -1 : 1)
              }
            }}
          >
            <GripIcon />
          </button>
        </HoverTips>
        <CheckBox checked={item.entry.enabled} onChange={onToggle} disabled={disabled} aria-label={`启用 ${name}`} />
        <div className="theme-row-meta">
          <button
            className="theme-row-title"
            type="button"
            aria-expanded={expanded}
            aria-controls={detailId}
            onClick={() => setExpanded(!expanded)}
          >
            {name}
          </button>
          {item.theme?.description?.trim() && <p className="theme-row-description">{item.theme.description}</p>}
        </div>
        <Button
          variant="ghost"
          size="small"
          aria-label={`${expanded ? '收起' : '展开'} ${name} 的详情`}
          aria-expanded={expanded}
          aria-controls={detailId}
          onClick={() => setExpanded(!expanded)}
        >
          <ChevronIcon open={expanded} />
        </Button>
      </div>
      {item.parseError && <p className="theme-row-error">{item.error || '主题无法解析，详细原因见运行记录。'}</p>}
      <div id={detailId} hidden={!expanded} className="theme-row-detail">
        <div className="theme-row-detail-actions">
          <span className="theme-row-author">{item.theme?.author || item.entry.id}</span>
          <Button size="small" variant="ghost" disabled={disabled || first} onClick={() => onMove(-1)}>
            上移
          </Button>
          <Button size="small" variant="ghost" disabled={disabled || last} onClick={() => onMove(1)}>
            下移
          </Button>
          <Button size="small" variant="ghost" disabled={disabled} onClick={onRemove}>
            移除主题
          </Button>
        </div>
        {item.theme && <ThemePatchView theme={item.theme} />}
      </div>
    </Reorder.Item>
  )
}

function GripIcon() {
  return (
    <svg width="16" height="18" viewBox="0 0 16 18" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="4" r="1" />
      <circle cx="11" cy="4" r="1" />
      <circle cx="5" cy="9" r="1" />
      <circle cx="11" cy="9" r="1" />
      <circle cx="5" cy="14" r="1" />
      <circle cx="11" cy="14" r="1" />
    </svg>
  )
}
function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d={open ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
    </svg>
  )
}
