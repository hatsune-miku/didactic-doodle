import { Button, Dot, Spinner, WhatsThis } from '@a1knla/cakeui'

import './index.scss'

interface LarkStatusProps {
  running: boolean | null
  error: string | null
  launching: boolean
  disabled: boolean
  onLaunch: () => void
  onExit: () => void
}

export default function LarkStatus({ running, error, launching, disabled, onLaunch, onExit }: LarkStatusProps) {
  const label = error ? '无法读取飞书状态' : running === null ? '正在检查飞书' : running ? '飞书运行中' : '飞书未运行'
  return (
    <div className="lark-status">
      {running === null && !error ? (
        <Spinner size="small" aria-hidden="true" className="lark-status-indicator" />
      ) : (
        <Dot tone={error ? 'danger' : running ? 'success' : 'neutral'} className="lark-status-indicator" />
      )}
      <span className="lark-status-label" aria-live="polite">
        {label}
      </span>
      {error && <WhatsThis label="飞书状态读取错误">{error}</WhatsThis>}
      {running === true && (
        <Button size="small" variant="ghost" aria-label="退出飞书" disabled={disabled} onClick={onExit}>
          退出
        </Button>
      )}
      {running === false && (
        <Button
          size="small"
          variant="ghost"
          aria-label="启动飞书"
          loading={launching}
          disabled={disabled}
          onClick={onLaunch}
        >
          启动
        </Button>
      )}
    </div>
  )
}
