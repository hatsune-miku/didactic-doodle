import { Alert, Button, Dot, ProgressBar } from '@a1knla/cakeui'

import LarkStatus from './components/LarkStatus'

import { ThemeEngineStore } from '../../../store/theme-engine'
import { Workspace } from '../../vm'

import './index.scss'

interface ActionBarProps {
  className?: string
  engine: ThemeEngineStore
  lark: Workspace['lark']
  loaded: boolean
  disabled: boolean
  libraryBusy: boolean
  enabledCount: number
  onApply: () => void
  onRestore: () => void
  onRetry: () => void
  onDismiss: () => void
  onShowLog: () => void
  onLaunch: () => void
  onExit: () => void
  onDismissLaunchError: () => void
}

export default function ActionBar({
  className,
  engine,
  lark,
  loaded,
  disabled,
  libraryBusy,
  enabledCount,
  onApply,
  onRestore,
  onRetry,
  onDismiss,
  onShowLog,
  onLaunch,
  onExit,
  onDismissLaunchError,
}: ActionBarProps) {
  const working = engine.workingState === 'working'
  const percent = engine.maxProgress
    ? Math.min(100, Math.round((engine.currentProgress / engine.maxProgress) * 100))
    : null
  const operationName = engine.lastOperation === 'restore' ? '恢复原版' : '应用主题'
  const showError = Boolean(engine.lastError) && !engine.permissionAction && !working

  return (
    <div className={`action-bar ${className ?? ''}`}>
      {working && (
        <div className="action-bar-progress" role="status">
          <ProgressBar
            className="action-bar-progress-bar"
            aria-label={`${operationName}进度`}
            max={engine.maxProgress || 1}
            value={engine.maxProgress ? engine.currentProgress : undefined}
          />
          <span className="action-bar-progress-text">
            {percent === null ? '正在准备' : `正在${operationName} ${percent}%`}
          </span>
        </div>
      )}
      {showError && (
        <Alert tone="danger" className="action-bar-alert">
          <span className="action-bar-alert-text wal-copyable">
            {operationName}失败：{engine.lastError}
          </span>
          <span className="action-bar-alert-actions">
            <Button size="small" onClick={onRetry} disabled={disabled}>
              重试
            </Button>
            <Button size="small" variant="ghost" onClick={onShowLog}>
              查看记录
            </Button>
            <Button size="small" variant="ghost" onClick={onDismiss}>
              关闭
            </Button>
          </span>
        </Alert>
      )}
      {lark.launchError && (
        <Alert tone="danger" className="action-bar-alert">
          <span className="action-bar-alert-text wal-copyable">{lark.launchError}</span>
          <span className="action-bar-alert-actions">
            <Button size="small" onClick={onLaunch} loading={lark.launching}>
              重试
            </Button>
            <Button size="small" variant="ghost" onClick={onDismissLaunchError}>
              关闭
            </Button>
          </span>
        </Alert>
      )}
      {engine.completionMessage && !engine.lastError && !working && (
        <div className="action-bar-done" role="status">
          <Dot tone="success" />
          <span className="action-bar-done-text">{engine.completionMessage}</span>
          <Button size="small" variant="ghost" className="action-bar-done-dismiss" onClick={onDismiss}>
            知道了
          </Button>
        </div>
      )}
      <div className="action-bar-main">
        <LarkStatus
          running={lark.running}
          error={lark.error}
          launching={lark.launching}
          disabled={working || lark.exiting}
          onLaunch={onLaunch}
          onExit={onExit}
        />
        <div className="action-bar-buttons">
          {enabledCount > 0 && (
            <Button variant="ghost" disabled={disabled || !loaded} onClick={onRestore}>
              恢复原版
            </Button>
          )}
          {/* 没有启用的主题时只剩恢复原版，它不是需要强调的主要操作。 */}
          <Button
            variant={enabledCount ? 'primary' : 'default'}
            loading={working}
            disabled={libraryBusy || !loaded || lark.exiting}
            onClick={enabledCount ? onApply : onRestore}
          >
            {enabledCount ? '应用主题' : '恢复原版'}
          </Button>
        </div>
      </div>
    </div>
  )
}
