import { useEffect, useMemo, useState } from 'react'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { getVersion } from '@tauri-apps/api/app'
import { Button, Card, CardBody, CardHeader, Divider, Progress } from '@heroui/react'
import './index.scss'

type Status = 'idle' | 'checking' | 'ready' | 'latest' | 'downloading' | 'error'

export default function WalSettingsPage() {
  const [currentVersion, setCurrentVersion] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const [available, setAvailable] = useState<Awaited<ReturnType<typeof check>>>(null)
  const [downloaded, setDownloaded] = useState(0)
  const [total, setTotal] = useState<number | undefined>(undefined)

  useEffect(() => {
    getVersion()
      .then(setCurrentVersion)
      .catch(() => setCurrentVersion('未知版本'))
  }, [])

  const releaseNotes = useMemo(() => {
    const notes: Record<string, string[]> = {
      // 示例：'0.1.2': ['新增更新检查页面', '优化启动性能']
    }
    return notes[currentVersion] ?? ['欸更新日志的功能还没做']
  }, [currentVersion])

  const progressValue = useMemo(() => {
    if (!total || total <= 0) {
      return 0
    }
    return Math.min(100, Math.floor((downloaded / total) * 100))
  }, [downloaded, total])

  async function handleCheck() {
    setStatus('checking')
    setMessage('')
    setAvailable(null)
    try {
      const update = await check()
      if (update) {
        setAvailable(update)
        setStatus('ready')
        setMessage(`发现新版本 ${update.version}`)
      } else {
        setStatus('latest')
        setMessage('已是最新版本')
      }
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : '检查更新失败')
    }
  }

  async function handleInstall() {
    if (!available) {
      return
    }
    setDownloaded(0)
    setTotal(undefined)
    setStatus('downloading')
    setMessage('')
    try {
      await available.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          setTotal(event.data.contentLength)
        }
        if (event.event === 'Progress') {
          setDownloaded((prev) => prev + event.data.chunkLength)
        }
      })
      setMessage('安装完成，正在重启…')
      await relaunch()
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : '下载或安装失败')
    }
  }

  return (
    <div className="wal-settings-page">
      <Card className="wal-settings-card" shadow="none">
        <CardBody className="space-y-3">
          <div className="wal-settings-header">
            <div className="wal-settings-info">
              <p className="wal-settings-title">当前版本 - {currentVersion || '--'}</p>
              {message ? <p className="wal-settings-message">{message}</p> : null}
            </div>
            <div className="wal-settings-actions">
              <Button
                color="primary"
                variant="flat"
                isLoading={status === 'checking'}
                onPress={handleCheck}
                size="sm"
                className="wal-settings-button"
              >
                {status === 'checking' ? '检查中…' : '检查更新'}
              </Button>
              <Button
                color="default"
                variant="flat"
                isDisabled={!available || status === 'downloading'}
                isLoading={status === 'downloading'}
                onPress={handleInstall}
                size="sm"
                className="wal-settings-button"
              >
                {status === 'downloading' ? '下载中…' : '下载并安装'}
              </Button>
            </div>
          </div>

          {status === 'downloading' && (
            <div className="wal-settings-progress-box">
              <Progress
                size="sm"
                value={progressValue}
                aria-label="update-progress"
                classNames={{ indicator: 'bg-rose-400', track: 'bg-rose-100' }}
              />
              <p className="wal-settings-progress-text">
                已下载 {Math.round(downloaded / 1024)} KB
                {total ? ` / ${Math.round(total / 1024)} KB` : ''}（{progressValue}%）
              </p>
            </div>
          )}

          {available && status === 'ready' && (
            <div className="wal-settings-update-box">
              <p className="wal-settings-update-title">
                新版本 {available.version}（当前 {available.currentVersion}）
              </p>
              {available.body ? (
                <p className="wal-settings-update-body">{available.body}</p>
              ) : (
                <p className="wal-settings-update-body">没有提供更新说明。</p>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="wal-settings-card" shadow="none">
        <CardHeader className="wal-settings-card-header">
          <div className="space-y-0.5">
            <p className="wal-settings-card-title">更新内容</p>
          </div>
        </CardHeader>
        <Divider className="wal-settings-divider" />
        <CardBody className="space-y-2">
          <ul className="wal-settings-list">
            {releaseNotes.map((item, index) => (
              <li key={index} className="wal-settings-list-item">
                <span />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  )
}
