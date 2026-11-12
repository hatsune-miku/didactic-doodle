import { useState } from 'react'

import { Reorder, useDragControls, useReducedMotion } from 'framer-motion'

import { CheckBox, HoverTips } from '@a1knla/cakeui'

import { LibraryItem, themeDisplayName } from '../../../../../store/theme-library'

import './index.scss'

interface ThemeRowProps {
  item: LibraryItem
  priority: number | null
  selected: boolean
  disabled: boolean
  first: boolean
  last: boolean
  detailId: string
  onSelect: () => void
  onToggle: () => void
  onMove: (offset: number) => void
  onDragEnd: () => void
}

export default function ThemeRow({
  item,
  priority,
  selected,
  disabled,
  first,
  last,
  detailId,
  onSelect,
  onToggle,
  onMove,
  onDragEnd,
}: ThemeRowProps) {
  const dragControls = useDragControls()
  const reducedMotion = useReducedMotion()
  const [dragging, setDragging] = useState(false)
  const name = themeDisplayName(item)
  const summary = item.parseError ? '无法读取此主题' : item.theme?.description?.trim() || item.theme?.author?.trim()

  return (
    <Reorder.Item
      as="li"
      value={item.entry.id}
      dragListener={false}
      dragControls={dragControls}
      drag={disabled ? false : 'y'}
      onDragStart={() => setDragging(true)}
      onDragEnd={() => {
        setDragging(false)
        onDragEnd()
      }}
      transition={{ duration: reducedMotion ? 0 : 0.2, ease: [0.29, 0, 0, 1] }}
      className="theme-row"
      data-selected={selected}
      data-enabled={item.entry.enabled}
      data-invalid={item.parseError}
      data-dragging={dragging}
    >
      <HoverTips content="拖动排序，也可按上下方向键">
        <button
          type="button"
          className="theme-row-grip"
          aria-label={`调整 ${name} 的顺序`}
          aria-keyshortcuts="ArrowUp ArrowDown"
          disabled={disabled}
          onPointerDown={(event) => dragControls.start(event)}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
            event.preventDefault()
            if (event.key === 'ArrowUp' && !first) onMove(-1)
            if (event.key === 'ArrowDown' && !last) onMove(1)
          }}
        >
          <GripIcon />
        </button>
      </HoverTips>
      <CheckBox
        className="theme-row-check"
        checked={item.entry.enabled}
        onChange={onToggle}
        disabled={disabled}
        aria-label={`启用 ${name}`}
      />
      <button
        type="button"
        className="theme-row-main"
        aria-current={selected || undefined}
        aria-controls={detailId}
        onClick={onSelect}
      >
        <span className="theme-row-name">{name}</span>
        {summary && <span className="theme-row-summary">{summary}</span>}
        {priority !== null && <span className="wal-visually-hidden">，第 {priority} 优先</span>}
      </button>
      {priority !== null && (
        <span className="theme-row-priority" aria-hidden="true">
          {priority}
        </span>
      )}
    </Reorder.Item>
  )
}

function GripIcon() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
      <circle cx="2.5" cy="3" r="1.25" />
      <circle cx="7.5" cy="3" r="1.25" />
      <circle cx="2.5" cy="8" r="1.25" />
      <circle cx="7.5" cy="8" r="1.25" />
      <circle cx="2.5" cy="13" r="1.25" />
      <circle cx="7.5" cy="13" r="1.25" />
    </svg>
  )
}
