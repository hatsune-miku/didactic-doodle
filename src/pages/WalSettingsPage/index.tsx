import { useEffect, useMemo, useState } from 'react'
import { getVersion } from '@tauri-apps/api/app'
import { Button, Card, CardBody, CardHeader, Divider } from '@heroui/react'
import './index.scss'

export default function WalSettingsPage() {
  const [currentVersion, setCurrentVersion] = useState('')
  const [message, setMessage] = useState('')

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

  // 内置自动更新已移除，更新交由 KFC 统一管理。
  function handleCheck() {
    setMessage('更新由 KFC 统一管理')
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
                onPress={handleCheck}
                size="sm"
                className="wal-settings-button"
              >
                检查更新
              </Button>
            </div>
          </div>
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
