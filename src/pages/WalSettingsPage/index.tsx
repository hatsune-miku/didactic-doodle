import { useEffect, useMemo, useState } from 'react'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { getVersion } from '@tauri-apps/api/app'
import { Button, Card, CardBody, CardHeader, Divider, Progress } from '@heroui/react'

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
    <div className="w-full flex flex-col gap-3 p-3 text-slate-800">
      <Card className="border border-pink-100 bg-pink-50" shadow="none">
        <CardBody className="space-y-3">
          <div className="flex gap-2 flex-row items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-900">当前版本 - {currentVersion || '--'}</p>
              {message ? <p className="text-xs text-slate-500">{message}</p> : null}
            </div>
            <div className="flex gap-2">
              <Button
                color="primary"
                variant="flat"
                isLoading={status === 'checking'}
                onPress={handleCheck}
                size="sm"
                className="bg-pink-100"
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
                className="bg-slate-100 text-slate-700"
              >
                {status === 'downloading' ? '下载中…' : '下载并安装'}
              </Button>
            </div>
          </div>

          {status === 'downloading' && (
            <div className="space-y-2 rounded-lg border border-pink-100 bg-white px-3 py-2">
              <Progress
                size="sm"
                value={progressValue}
                aria-label="update-progress"
                classNames={{ indicator: 'bg-primary', track: 'bg-pink-100' }}
              />
              <p className="text-[11px] text-slate-600">
                已下载 {Math.round(downloaded / 1024)} KB
                {total ? ` / ${Math.round(total / 1024)} KB` : ''}（{progressValue}%）
              </p>
            </div>
          )}

          {available && status === 'ready' && (
            <div className="space-y-2 rounded-lg border border-emerald-100 bg-white px-3 py-2">
              <p className="text-xs font-semibold text-emerald-700">
                新版本 {available.version}（当前 {available.currentVersion}）
              </p>
              {available.body ? (
                <p className="text-[11px] text-emerald-700">{available.body}</p>
              ) : (
                <p className="text-[11px] text-emerald-700">没有提供更新说明。</p>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="border border-pink-100 bg-white" shadow="none">
        <CardHeader className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-slate-900">更新内容</p>
          </div>
        </CardHeader>
        <Divider className="border-pink-100" />
        <CardBody className="space-y-2">
          <ul className="space-y-1.5 text-xs text-slate-800">
            {releaseNotes.map((item, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-pink-300" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  )
}
