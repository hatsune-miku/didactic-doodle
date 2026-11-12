import { useEffect, useRef, useState } from 'react'

import { Reorder } from 'framer-motion'

import { Alert, Button, ProgressBar, Spinner, WhatsThis } from '@a1knla/cakeui'

import ThemeRow from './components/ThemeRow'
import { useThemeLoaderViewModel } from './vm'

import { useThemeLibraryStore } from '../../store/theme-library'

import './index.scss'

export default function ThemeLoaderPage() {
  const vm = useThemeLoaderViewModel()
  const [orderedIds, setOrderedIds] = useState<string[]>([])
  const orderRef = useRef<string[]>([])
  useEffect(() => {
    const ids = vm.items.map((item) => item.entry.id)
    orderRef.current = ids
    setOrderedIds(ids)
  }, [vm.items])
  const byId = new Map(vm.items.map((item) => [item.entry.id, item]))

  function handleReorder(ids: string[]) {
    if (vm.disabled) return
    orderRef.current = ids
    setOrderedIds(ids)
  }
  async function handleSaveOrder() {
    await vm.handleReorder(orderRef.current)
    const ids = useThemeLibraryStore.getState().items.map((item) => item.entry.id)
    orderRef.current = ids
    setOrderedIds(ids)
  }
  function handleMove(id: string, offset: number) {
    const ids = vm.items.map((item) => item.entry.id)
    const index = ids.indexOf(id)
    const next = index + offset
    if (next < 0 || next >= ids.length) return
    ;[ids[index], ids[next]] = [ids[next], ids[index]]
    return vm.handleReorder(ids)
  }

  return (
    <section className="theme-loader" aria-label="主题">
      <div className="theme-loader-toolbar">
        <Button onClick={vm.handleImport} disabled={vm.disabled || !vm.loaded}>
          导入主题
        </Button>
        <Button variant="ghost" onClick={vm.handleOpenEditor} disabled={vm.disabled}>
          主题编辑器
        </Button>
        <WhatsThis label="主题应用和排序说明">
          勾选要应用的主题。上方优先级更高，可拖动排序或在排序按钮上使用上下方向键。
        </WhatsThis>
      </div>
      {vm.libraryError && (
        <Alert tone="danger" className="theme-loader-notice">
          <span className="wal-copyable">{vm.libraryError}</span>
          <Button size="small" onClick={vm.handleRetryLibrary} disabled={vm.disabled}>
            重试
          </Button>
        </Alert>
      )}
      <div className="theme-loader-library" aria-busy={vm.libraryBusy}>
        {!vm.loaded && vm.libraryBusy ? (
          <div className="theme-loader-empty">
            <Spinner aria-label="正在读取主题" />
          </div>
        ) : vm.items.length === 0 ? (
          <div className="theme-loader-empty">
            <p>暂无主题</p>
            <p className="theme-loader-hint">导入 YAML 文件后即可应用。</p>
          </div>
        ) : (
          <Reorder.Group as="ul" axis="y" values={orderedIds} onReorder={handleReorder} className="theme-loader-list">
            {orderedIds.map((id, index) => {
              const item = byId.get(id)
              return item ? (
                <ThemeRow
                  key={id}
                  item={item}
                  disabled={vm.disabled}
                  first={index === 0}
                  last={index === orderedIds.length - 1}
                  onToggle={() => vm.handleToggle(id)}
                  onRemove={() => vm.handleRemove(id)}
                  onMove={(offset) => handleMove(id, offset)}
                  onDragEnd={handleSaveOrder}
                />
              ) : null
            })}
          </Reorder.Group>
        )}
      </div>
      <div className="theme-loader-footer">
        {vm.workingState === 'working' && (
          <div className="theme-loader-progress" role="status">
            <ProgressBar
              aria-label="处理主题"
              max={vm.maxProgress || 1}
              value={vm.maxProgress ? vm.currentProgress : undefined}
            />
            <span>
              {vm.maxProgress
                ? `正在处理 ${Math.min(100, Math.round((vm.currentProgress / vm.maxProgress) * 100))}%`
                : '正在准备'}
            </span>
          </div>
        )}
        {vm.lastError && !vm.permissionAction && (
          <Alert tone="danger" className="theme-loader-notice">
            <span className="wal-copyable">{vm.lastError}</span>
            <div className="theme-loader-notice-actions">
              <Button size="small" onClick={vm.handleRetryOperation} disabled={vm.disabled}>
                重试
              </Button>
              <Button size="small" variant="ghost" onClick={vm.handleDismissStatus}>
                关闭
              </Button>
            </div>
          </Alert>
        )}
        {vm.completionMessage && !vm.lastError && (
          <div className="theme-loader-complete" role="status">
            <span>{vm.completionMessage}</span>
            <Button size="small" variant="ghost" onClick={vm.handleLaunch} disabled={vm.disabled}>
              启动飞书
            </Button>
          </div>
        )}
        <div className="theme-loader-actions">
          {vm.enabledCount > 0 && (
            <Button variant="ghost" disabled={vm.disabled} onClick={vm.handleRestore}>
              恢复原版
            </Button>
          )}
          <Button
            variant="primary"
            loading={vm.workingState === 'working'}
            disabled={vm.libraryBusy || !vm.loaded}
            onClick={vm.handleApply}
          >
            {vm.enabledCount ? '应用主题' : '恢复原版'}
          </Button>
        </div>
      </div>
    </section>
  )
}
