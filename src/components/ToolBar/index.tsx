import { Button } from '@heroui/react'
import { useLarkRunning } from '../../utils/use-lark-running'
import { DoubleCheckButton } from '../DoubleCheckButton'
import { nativeBridge } from '../../ports/bridge'
import { openUrl } from '@tauri-apps/plugin-opener'
import './index.scss'

export default function ToolBar() {
  const larkRunning = useLarkRunning()

  function handleOpenThemeEditor() {
    openUrl('https://wal-theme.vanillacake.cn/')
  }

  return (
    <div className="toolbar">
      <DoubleCheckButton
        onDoubleChecked={handleOpenThemeEditor}
        doubleCheckText="即将跳转网页"
        className="lark-tool-button"
        size="sm"
      >
        打开主题编辑器
      </DoubleCheckButton>
      {larkRunning ? (
        <DoubleCheckButton onDoubleChecked={nativeBridge.killLark} className="lark-tool-button" size="sm">
          结束飞书进程
        </DoubleCheckButton>
      ) : (
        <Button onPress={nativeBridge.launchLark} className="toolbar-button" size="sm">
          启动飞书
        </Button>
      )}
    </div>
  )
}
