import { useEffect, useRef, useState } from 'react'

import { Reorder } from 'framer-motion'

import { Alert, Button, Skeleton } from '@a1knla/cakeui'

import ThemeRow from './components/ThemeRow'

import { LibraryItem, useThemeLibraryStore } from '../../../store/theme-library'

import './index.scss'

interface ThemeListProps {
  className?: string
  items: LibraryItem[]
  loaded: boolean
  busy: boolean
  error: string | null
  disabled: boolean
  selectedId: string | null
  detailId: string
  onSelect: (id: string) => void
  onToggle: (id: string) => void
  onMove: (id: string, offset: number) => void
  onReorder: (ids: string[]) => Promise<void>
  onImport: () => void
  onRetry: () => void
  onDismissError: () => void
}

export default function ThemeList({
  className,
  items,
  loaded,
  busy,
  error,
  disabled,
  selectedId,
  detailId,
  onSelect,
  onToggle,
  onMove,
  onReorder,
  onImport,
  onRetry,
  onDismissError,
}: ThemeListProps) {
  const [orderedIds, setOrderedIds] = useState<string[]>([])
  const orderRef = useRef<string[]>([])
  useEffect(() => {
    const ids = items.map((item) => item.entry.id)
    orderRef.current = ids
    setOrderedIds(ids)
  }, [items])

  const byId = new Map(items.map((item) => [item.entry.id, item]))
  const priorities = new Map(
    orderedIds.filter((id) => byId.get(id)?.entry.enabled).map((id, index) => [id, index + 1] as const)
  )

  function handleDrag(ids: string[]) {
    if (disabled) return
    orderRef.current = ids
    setOrderedIds(ids)
  }
  async function handleDragEnd() {
    const changed = orderRef.current.some((id, index) => id !== items[index]?.entry.id)
    if (changed) await onReorder(orderRef.current)
    // 持久化失败时回到库中的实际顺序。
    const ids = useThemeLibraryStore.getState().items.map((item) => item.entry.id)
    orderRef.current = ids
    setOrderedIds(ids)
  }

  return (
    <section className={`theme-list ${className ?? ''}`} aria-label="主题" aria-busy={busy}>
      {error && loaded && (
        <Alert tone="danger" className="theme-list-alert">
          <span className="theme-list-alert-text wal-copyable">{error}</span>
          <span className="theme-list-alert-actions">
            <Button size="small" onClick={onRetry} disabled={disabled}>
              重试
            </Button>
            <Button size="small" variant="ghost" onClick={onDismissError}>
              关闭
            </Button>
          </span>
        </Alert>
      )}
      <div className="theme-list-card">
        {!loaded && error ? (
          <div className="theme-list-state">
            <p className="theme-list-state-title">无法读取主题库</p>
            <p className="theme-list-state-detail wal-copyable">{error}</p>
            <Button variant="primary" className="theme-list-state-action" onClick={onRetry} disabled={busy}>
              重试
            </Button>
          </div>
        ) : !loaded ? (
          <div className="theme-list-skeleton" aria-label="正在读取主题" role="status">
            {[0, 1, 2].map((index) => (
              <div className="theme-list-skeleton-row" key={index}>
                <Skeleton className="theme-list-skeleton-check" />
                <span className="theme-list-skeleton-text">
                  <Skeleton className="theme-list-skeleton-name" />
                  <Skeleton className="theme-list-skeleton-summary" />
                </span>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="theme-list-state">
            <p className="theme-list-state-title">还没有主题</p>
            <p className="theme-list-state-detail">导入 YAML 主题文件后，在这里启用和排序。</p>
            <Button variant="primary" className="theme-list-state-action" onClick={onImport} disabled={disabled}>
              导入主题
            </Button>
          </div>
        ) : (
          <Reorder.Group as="ul" axis="y" values={orderedIds} onReorder={handleDrag} className="theme-list-items">
            {orderedIds.map((id, index) => {
              const item = byId.get(id)
              return item ? (
                <ThemeRow
                  key={id}
                  item={item}
                  priority={priorities.get(id) ?? null}
                  selected={id === selectedId}
                  disabled={disabled}
                  first={index === 0}
                  last={index === orderedIds.length - 1}
                  detailId={detailId}
                  onSelect={() => onSelect(id)}
                  onToggle={() => onToggle(id)}
                  onMove={(offset) => onMove(id, offset)}
                  onDragEnd={handleDragEnd}
                />
              ) : null
            })}
          </Reorder.Group>
        )}
      </div>
    </section>
  )
}
