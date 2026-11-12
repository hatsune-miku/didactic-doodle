import { useRef, useState } from 'react'

import { Alert, Button, Dialog, HoverTips } from '@a1knla/cakeui'

import { nativeBridge } from '../../ports/bridge'
import { useLogsStore } from '../../store/logs'
import { useThemeEngineStore } from '../../store/theme-engine'
import { useLarkRunning } from '../../utils/use-lark-running'

import './index.scss'

export default function ToolBar() {
  const { running, error: statusError } = useLarkRunning()
  const engineWorking = useThemeEngineStore((state) => state.workingState === 'working')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [confirmExit, setConfirmExit] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function runAction(action: 'launch' | 'kill') {
    if (busyRef.current || useThemeEngineStore.getState().workingState === 'working') return
    busyRef.current = true
    setBusy(true)
    setError(null)
    try {
      if (action === 'launch') await nativeBridge.launchLark()
      else await nativeBridge.killLark()
      setConfirmExit(false)
    } catch (error) {
      const message = `${action === 'launch' ? '启动' : '结束'}飞书失败: ${String(error)}`
      setError(message)
      useLogsStore.getState().add(message)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <div className="toolbar">
      <div className="toolbar-status">
        <span className="toolbar-status-label">
          {running === null ? '正在检查飞书' : running ? '飞书正在运行' : '飞书已退出'}
        </span>
        {statusError ? (
          <HoverTips content={statusError}>
            <Button variant="ghost" size="small" aria-label="查看飞书状态读取错误">
              状态读取失败
            </Button>
          </HoverTips>
        ) : (
          <Button
            size="small"
            variant="ghost"
            loading={busy && !confirmExit}
            disabled={engineWorking || running === null}
            onClick={() => (running ? setConfirmExit(true) : runAction('launch'))}
          >
            {running ? '结束进程' : '启动飞书'}
          </Button>
        )}
      </div>
      {error && !confirmExit && (
        <Alert tone="danger" className="toolbar-error">
          {error}
          <Button size="small" variant="ghost" onClick={() => runAction('launch')}>
            重试
          </Button>
        </Alert>
      )}
      <Dialog
        open={confirmExit}
        onOpenChange={setConfirmExit}
        title="结束飞书进程？"
        description="未保存的内容可能丢失。"
        closeLabel="关闭"
        footer={
          <>
            <Button onClick={() => setConfirmExit(false)}>取消</Button>
            <Button variant="danger" loading={busy} disabled={engineWorking} onClick={() => runAction('kill')}>
              结束进程
            </Button>
          </>
        }
      >
        {error && <Alert tone="danger">{error}</Alert>}
      </Dialog>
    </div>
  )
}
