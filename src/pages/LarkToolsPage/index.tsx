import { Button, Spinner } from '@heroui/react'
import { nativeBridge } from '../../ports/bridge'
import { useState } from 'react'
import classNames from 'classnames'
import { DoubleCheckButton } from '../../components/DoubleCheckButton'
import './index.scss'
import { useLogsStore } from '../../store/logs'

interface Tool {
  title: string
  hint: string
  button?: string
  doubleCheck?: boolean
  action: () => Promise<void>
}

export default function LarkToolsPage() {
  const tools: Tool[] = [
    {
      title: '恢复到官方原版',
      hint: '还原所有的备份文件',
      button: '还原',
      doubleCheck: true,
      action: restoreToOfficialVersion,
    },
    {
      title: '结束飞书进程',
      hint: '结束飞书主进程及其所有子进程',
      button: '结束',
      doubleCheck: true,
      action: nativeBridge.killLark,
    },
    {
      title: '启动飞书',
      hint: '以默认参数启动飞书',
      button: '启动',
      doubleCheck: false,
      action: nativeBridge.launchLark,
    },
    {
      title: '打开飞书安装目录',
      hint: '根据注册表记载的位置打开飞书安装目录',
      button: '打开',
      doubleCheck: false,
      action: nativeBridge.openLarkInstallDirectory,
    },
  ]

  const [workingTool, setWorkingTool] = useState<Tool | null>(null)

  async function restoreToOfficialVersion() {
    if (await nativeBridge.isLarkRunning()) {
      useLogsStore.getState().add('飞书正在运行，请先关闭')
      return
    }
    return nativeBridge.withLarkSession((s) => {
      return s.restoreAllBackups()
    })
  }

  function handleExecuteTool(tool: Tool) {
    return async () => {
      setWorkingTool(tool)
      try {
        await tool.action()
      } finally {
        setWorkingTool(null)
      }
    }
  }

  return (
    <div className="lark-tools-page overflow-y-auto scrollbar-hide">
      <div className={classNames('lark-tools-grid', { 'is-working': workingTool })}>
        {tools.map((tool) => (
          <div
            key={tool.title}
            className={classNames('lark-tool-card', {
              'is-disabled': workingTool && workingTool !== tool,
            })}
          >
            <div className="lark-tool-content">
              <div className="lark-tool-info flex-row flex items-center justify-between">
                <div className="flex flex-col">
                  <h3 className="lark-tool-title">{tool.title}</h3>
                  <p className="lark-tool-hint">{tool.hint}</p>
                </div>
                {tool.doubleCheck ? (
                  <DoubleCheckButton
                    onDoubleChecked={handleExecuteTool(tool)}
                    doubleCheckText="确认执行"
                    temporaryDisableText="执行中"
                    size="sm"
                    variant="flat"
                    className="lark-tool-button"
                  >
                    {tool.button || '启动'}
                  </DoubleCheckButton>
                ) : (
                  <Button size="sm" variant="flat" onPress={handleExecuteTool(tool)} className="lark-tool-button">
                    {tool.button || '启动'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {workingTool ? (
        <div className="lark-tools-overlay">
          <div className="lark-tools-spinner-wrapper">
            <Spinner size="lg" className="lark-tools-spinner" />
            <span className="lark-tools-loading-text">{workingTool.title} 执行中...</span>
          </div>
        </div>
      ) : null}
    </div>
  )
}
