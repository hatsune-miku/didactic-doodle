import { useRef, useState } from 'react'

import { Alert, Button, Dialog } from '@a1knla/cakeui'

import { nativeBridge } from '../../ports/bridge'
import { useThemeEngineStore } from '../../store/theme-engine'
import { retryPendingThemeOperation } from '../../theme/operations'

import './index.scss'

export default function AppManagementPermission() {
  const action = useThemeEngineStore((state) => state.permissionAction)
  const [openingSettings, setOpeningSettings] = useState(false)
  const [settingsError, setSettingsError] = useState('')
  const settingsButton = useRef<HTMLButtonElement>(null)

  function handleClose(open: boolean) {
    if (open) return
    useThemeEngineStore.getState().setPermissionAction(null)
    setSettingsError('')
  }

  async function handleOpenSettings() {
    setOpeningSettings(true)
    setSettingsError('')
    try {
      await nativeBridge.openAppManagementSettings()
    } catch (error) {
      setSettingsError(`打开系统设置失败: ${String(error)}`)
    } finally {
      setOpeningSettings(false)
    }
  }

  return (
    <Dialog
      open={action !== null}
      onOpenChange={handleClose}
      title="允许修改飞书"
      closeLabel="关闭"
      initialFocus={settingsButton}
      className="app-management-permission"
      footer={
        <>
          <Button variant="ghost" onClick={() => handleClose(false)}>
            稍后
          </Button>
          <Button onClick={retryPendingThemeOperation}>已允许，重试</Button>
          <Button ref={settingsButton} variant="primary" loading={openingSettings} onClick={handleOpenSettings}>
            打开系统设置
          </Button>
        </>
      }
    >
      <p>在隐私与安全性的 App 管理中，开启 wal-assistant-lark。</p>
      <details className="app-management-help">
        <summary className="app-management-help-title">找不到应用或仍被阻止</summary>
        <p className="app-management-help-text">
          用 ＋ 添加当前 WAL 应用；已开启时可关闭后重新开启。系统要求重新打开时，重启 WAL 后再试。
        </p>
      </details>
      {settingsError && (
        <Alert tone="danger" className="app-management-error">
          {settingsError}
        </Alert>
      )}
    </Dialog>
  )
}
