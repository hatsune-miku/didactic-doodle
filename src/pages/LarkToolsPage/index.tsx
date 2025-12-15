import { Button, Card, CardBody, CardHeader, Spinner } from '@heroui/react'
import { nativeBridge } from '../../ports/bridge'
import { useState } from 'react'
import classNames from 'classnames'
import { DoubleCheckButton } from '../../components/DoubleCheckButton'

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
    <div className="w-full flex flex-col gap-3 p-3 text-slate-800">
      <Card className="border border-pink-100 bg-pink-50" shadow="none">
        <CardHeader className="flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-slate-900">工具箱</p>
          </div>
        </CardHeader>
        <CardBody className="grid gap-2 sm:grid-cols-2">
          {tools.map((tool) => (
            <div
              key={tool.title}
              className={classNames('rounded-lg border border-pink-100 bg-white px-3 py-2 flex flex-col gap-2', {
                'opacity-20': workingTool,
                'blur-[1px]': workingTool,
              })}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">{tool.title}</p>
                {tool.doubleCheck ? (
                  <DoubleCheckButton
                    onDoubleChecked={handleExecuteTool(tool)}
                    doubleCheckText="确认执行"
                    temporaryDisableText="执行中"
                    size="sm"
                    variant="flat"
                  >
                    {tool.button || '启动'}
                  </DoubleCheckButton>
                ) : (
                  <Button size="sm" variant="flat" onPress={handleExecuteTool(tool)}>
                    {tool.button || '启动'}
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-slate-500">{tool.hint}</p>
            </div>
          ))}
          {workingTool ? (
            <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center gap-4">
              <Spinner size="md" variant="simple" />
              <span className="text-sm">{workingTool.title} 执行中...</span>
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  )
}
