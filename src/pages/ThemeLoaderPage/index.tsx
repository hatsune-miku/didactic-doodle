import { useState } from 'react'
import { Reorder, useDragControls } from 'framer-motion'
import { Button, Checkbox, Progress } from '@heroui/react'
import classNames from 'classnames'
import { LibraryItem, themeDisplayName } from '../../store/theme-library'
import { ThemePatchView } from './ThemePatchView'
import { useThemeLoaderViewModel } from './vm'
import './index.scss'

export default function ThemeLoaderPage() {
  const vm = useThemeLoaderViewModel()

  function renderThemeList() {
    if (vm.items.length === 0) {
      return (
        <div className="theme-loader-empty">
          <span>还没有任何主题。</span>
          <span>点击「导入主题」添加一个 YAML 主题，勾选后即可一起应用。</span>
        </div>
      )
    }

    return (
      <Reorder.Group
        as="div"
        axis="y"
        values={vm.items.map((item) => item.entry.id)}
        onReorder={vm.handleReorder}
        className="theme-list"
      >
        {vm.items.map((item) => (
          <ThemeRow
            key={item.entry.id}
            item={item}
            onToggle={() => vm.handleToggle(item.entry.id)}
            onRemove={() => vm.handleRemove(item.entry.id)}
          />
        ))}
      </Reorder.Group>
    )
  }

  function renderWorkingState() {
    if (vm.workingState === 'idle') {
      return (
        <div className="theme-loader-content">
          <div className="theme-loader-actions">
            <Button onPress={vm.handleImport} variant="flat" size="sm" className="theme-loader-button">
              导入主题
            </Button>
            <Button
              onPress={vm.handleApply}
              variant="flat"
              size="sm"
              color="primary"
              className="theme-loader-button"
              style={{ flex: 1 }}
            >
              {vm.enabledCount > 0 ? `应用启用的主题 (${vm.enabledCount})` : '应用（还原为官方原版）'}
            </Button>
          </div>

          <div className="theme-loader-scroll">{renderThemeList()}</div>
        </div>
      )
    }

    if (vm.workingState === 'working') {
      return (
        <div className="theme-loader-state">
          <Progress value={vm.currentProgress} maxValue={vm.maxProgress} />
          <span>
            {vm.maxProgress === 0 ? '准备中...' : `${Math.round((vm.currentProgress / vm.maxProgress) * 100)}%`}
          </span>
        </div>
      )
    }

    if (vm.workingState === 'done') {
      return (
        <div className="theme-loader-state">
          <span>任务完成~</span>
          <div className="flex flex-row gap-2">
            <Button
              onPress={vm.handleFinishAndLaunchLark}
              variant="flat"
              color="primary"
              size="sm"
              className="theme-loader-button"
            >
              完成并启动飞书
            </Button>
            <Button onPress={vm.handleFinish} variant="flat" size="sm" className="theme-loader-button">
              完成
            </Button>
          </div>
        </div>
      )
    }

    if (vm.workingState === 'error') {
      return (
        <div className="theme-loader-state">
          <span>任务失败</span>
          <Button onPress={vm.handleFinishAndRestoreBackups} variant="flat" size="sm" className="theme-loader-button">
            还原备份
          </Button>
        </div>
      )
    }

    return null
  }

  return <div className="theme-loader-page">{renderWorkingState()}</div>
}

interface ThemeRowProps {
  item: LibraryItem
  onToggle: () => void
  onRemove: () => void
}

function ThemeRow(props: ThemeRowProps) {
  const { item, onToggle, onRemove } = props
  const [expanded, setExpanded] = useState(false)
  const dragControls = useDragControls()

  const author = item.theme?.author?.trim()
  const description = item.theme?.description?.trim()

  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()

  return (
    <Reorder.Item
      as="div"
      value={item.entry.id}
      dragListener={false}
      dragControls={dragControls}
      transition={{ duration: 0 }}
      className={classNames('theme-item', { 'is-disabled': !item.entry.enabled })}
      onClick={onToggle}
    >
      <div className="theme-item-head">
        <span
          className="theme-drag-handle"
          title="拖动排序"
          onPointerDown={(e) => dragControls.start(e)}
          onClick={stop}
        >
          ⠿
        </span>
        <span className="theme-item-check" onClick={stop}>
          <Checkbox isSelected={item.entry.enabled} onValueChange={onToggle} />
        </span>
        <div className="theme-item-meta">
          <div className="theme-item-name">
            <span className="theme-item-title">{themeDisplayName(item)}</span>
            {author ? <span className="theme-item-author">by {author}</span> : null}
          </div>
          {description ? <div className="theme-item-desc">{description}</div> : null}
        </div>
        <span onClick={stop}>
          <Button size="sm" variant="flat" className="theme-loader-button" onPress={onRemove}>
            删除
          </Button>
        </span>
        <button
          type="button"
          className="theme-expand"
          aria-label={expanded ? '收起详情' : '展开详情'}
          onClick={(e) => {
            stop(e)
            setExpanded((value) => !value)
          }}
        >
          <ChevronIcon open={expanded} />
        </button>
      </div>

      {item.parseError ? <div className="theme-item-error">无法解析此主题文件（已忽略，建议删除）。</div> : null}

      {expanded && item.theme ? (
        <div className="theme-item-detail" onClick={stop}>
          <div className="theme-item-id">id: {item.entry.id}</div>
          <ThemePatchView theme={item.theme} />
        </div>
      ) : null}
    </Reorder.Item>
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
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {open ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
    </svg>
  )
}
