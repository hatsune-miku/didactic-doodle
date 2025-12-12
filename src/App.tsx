import { Accordion, AccordionItem, Button, Progress } from '@heroui/react'
import React, { useEffect, useRef, useState } from 'react'
import { LarkSession, nativeBridge } from './ports/bridge'
import { makeStylesScript } from './helper/style-scripts'
import { Log, useLogsStore } from './store/logs'
import { DateTime } from 'luxon'
import classNames from 'classnames'
import { DoubleCheckButton } from './components/DoubleCheckButton'
import { promptAndLoadTheme } from './theme'
import { WalTheme } from './theme/types'
import { joinPath } from './utils/path'

import './App.scss'

interface PatchState {
  hasBackup: boolean
}

type WorkingState = 'idle' | 'working' | 'done' | 'error'

function App() {
  const logsStore = useLogsStore()
  const logsContainerRef = useRef<HTMLDivElement>(null)
  const sessionRef = useRef<LarkSession | null>(null)
  const larkBasePathRef = useRef<string | null>(null)

  const [workingState, setWorkingState] = useState<WorkingState>('idle')
  const [activeTheme, setActiveTheme] = useState<WalTheme | null>(null)
  const [patchStateMap, setPatchStateMap] = useState<Record<string, PatchState>>({})
  const [currentProgress, setCurrentProgress] = useState(0)
  const [maxProgress, setMaxProgress] = useState(0)

  const hasPendingBackups = Object.values(patchStateMap).some((state) => state.hasBackup)

  async function ensureSession(): Promise<LarkSession> {
    if (sessionRef.current) {
      return sessionRef.current
    }
    const session = await nativeBridge.createLarkSession()
    sessionRef.current = session
    return session
  }

  function handleKillLark() {
    nativeBridge.killLark()
  }

  function getPatchState(asarFile: string): PatchState {
    return patchStateMap[asarFile] || { hasBackup: false }
  }

  async function handleLoadTheme() {
    const theme = await promptAndLoadTheme()
    if (!theme) {
      logsStore.add('加载主题失败')
      return
    }
    setActiveTheme(theme)
  }

  async function handleApplyPatch() {
    if (await nativeBridge.isLarkRunning()) {
      logsStore.add('飞书正在运行，请先关闭')
      return
    }

    if (!activeTheme) {
      logsStore.add('请先加载主题')
      return
    }

    setWorkingState('working')
    try {
      const entries = Object.entries(activeTheme.asarPatches)
      setCurrentProgress(0)
      setMaxProgress(entries.length)

      for (const [asarFile, patches] of entries) {
        if (!patches || patches.length === 0) {
          continue
        }
        const session = await ensureSession()
        logsStore.add(`正在修改 asar 文件: ${asarFile}`)

        for (let index = 0; index < patches.length; index++) {
          logsStore.add(`补丁 ${index + 1} 开始应用...`)
          const patch = patches[index]
          const script = makeStylesScript(patch)

          if (patch.kind === 'main-script') {
            await session.submitMainScriptPatch({
              asarPath: asarFile,
              subject: patch.subject,
              script,
            })
          } else {
            await session.submitPatch({
              asarPath: asarFile,
              innerPath: patch.path,
              script,
            })
          }
        }
        await session.applyPatches()
        setCurrentProgress((prev) => prev + 1)
      }
      setCurrentProgress(maxProgress)
      setWorkingState('done')
    } catch (error) {
      setCurrentProgress(0)
      setWorkingState('error')
      logsStore.add(`应用补丁失败: ${String(error)}`)
    }

    logsStore.add('=== 任务结束 ===')
  }

  async function refreshPatchState() {
    if (!activeTheme) {
      return
    }
    const session = await ensureSession()
    const patches = activeTheme.asarPatches
    const asarFiles = Object.keys(patches)
    const nextPatchStateMap: Record<string, PatchState> = {}

    await Promise.all(
      asarFiles.map(async (asarFile) => {
        const fullPath = joinPath(larkBasePathRef.current!, asarFile)
        const prev = getPatchState(asarFile)
        let hasBackup = prev.hasBackup
        try {
          hasBackup = await session.backupExists(fullPath)
        } catch {
          hasBackup = prev.hasBackup
        }
        nextPatchStateMap[asarFile] = {
          ...prev,
          hasBackup,
        }
      })
    )

    setPatchStateMap(nextPatchStateMap)
  }

  async function handleRestoreAllBackups() {
    if (await nativeBridge.isLarkRunning()) {
      logsStore.add('飞书正在运行，请先关闭')
      return
    }
    const session = await ensureSession()
    const asarFiles = Object.keys(patchStateMap)
    for (const asarFile of asarFiles) {
      await session.restoreBackup(joinPath(larkBasePathRef.current!, asarFile))
    }
    logsStore.add('所有备份已恢复')
    refreshPatchState()
  }

  async function handleRestoreBackup(asarFile: string) {
    if (await nativeBridge.isLarkRunning()) {
      logsStore.add('飞书正在运行，请先关闭')
      return
    }

    try {
      const session = await ensureSession()
      const fullPath = joinPath(larkBasePathRef.current!, asarFile)
      await session.restoreBackup(fullPath)
      logsStore.add(`已恢复备份: ${asarFile}`)
      refreshPatchState()
    } catch (error) {
      logsStore.add(`恢复备份失败: ${String(error)}`)
    }
  }

  useEffect(() => {
    refreshPatchState()
  }, [activeTheme])

  useEffect(() => {
    nativeBridge.getLarkBasePath().then((path) => {
      logsStore.add(`找到飞书路径: ${path}`)
      larkBasePathRef.current = path
    })
    const unsubscribe = nativeBridge.subscribeToLogEvents((message) => {
      logsStore.add(message)
    })
    return () => {
      unsubscribe.then((unsubscribe) => unsubscribe())
    }
  }, [])

  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight
    }
  }, [logsStore.logs.length])

  function handleFinishAndLaunchLark() {
    nativeBridge.launchLark()
    setWorkingState('idle')
  }

  function handleFinishAndRestoreBackups() {
    handleRestoreAllBackups()
    setWorkingState('idle')
  }

  function handleFinish() {
    setWorkingState('idle')
  }

  function renderLogs(logs: Log[]) {
    const components = []
    for (let index = 0; index < logs.length; index++) {
      const log = logs[index]
      const timeDelta = index === 0 ? 0 : log.timestamp - logs[index - 1].timestamp
      const shouldOmitDisplayDatetime = index !== 0 && timeDelta < 10000

      const displayDatetime = shouldOmitDisplayDatetime
        ? ''
        : DateTime.fromMillis(log.timestamp).toFormat('yyyy/MM/dd HH:mm:ss')
      const item = (
        <div
          key={index}
          className={classNames(
            'text-[12px] text-gray-600 leading-[14px] flex flex-row',
            index === 0 || shouldOmitDisplayDatetime ? '' : 'mt-2'
          )}
        >
          <div className="w-[120px] shrink-0">{displayDatetime}</div>
          <div className="wrap-anywhere">{log.text}</div>
        </div>
      )
      components.push(item)
    }
    return components
  }

  function isColorLike(value: string): boolean {
    const v = value.trim()
    if (/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v)) {
      return true
    }
    if (/^(rgb|rgba|hsl|hsla)\(/i.test(v)) {
      return true
    }
    const named = [
      'red',
      'green',
      'blue',
      'black',
      'white',
      'pink',
      'gray',
      'grey',
      'orange',
      'yellow',
      'purple',
      'cyan',
      'magenta',
      'transparent',
    ]
    if (named.includes(v.toLowerCase())) {
      return true
    }
    return false
  }

  function ColorPreview(props: { value: string }) {
    const { value } = props
    if (!isColorLike(value)) {
      return <span>{value}</span>
    }
    return (
      <span className="inline-flex items-center gap-1">
        <span className="inline-block w-3 h-3 rounded border border-gray-200" style={{ backgroundColor: value }} />
        <span>{value}</span>
      </span>
    )
  }

  function renderActiveTheme() {
    if (!activeTheme) {
      return (
        <div className="container mx-auto text-center flex flex-col gap-2 items-center justify-center w-full h-full">
          尚未加载主题配置文件。
          <Button onPress={handleLoadTheme} variant="flat" size="sm">
            加载主题
          </Button>
        </div>
      )
    }
    const patchesByAsar = activeTheme.asarPatches
    const asarFiles = Object.keys(patchesByAsar)
    if (asarFiles.length === 0) {
      return <span className="text-xs text-gray-500">当前主题不包含任何补丁</span>
    }

    return (
      <Accordion
        defaultExpandedKeys={asarFiles}
        className="main-accordion"
        dividerProps={{
          style: {
            backgroundColor: 'transparent',
            height: '4px',
          },
        }}
      >
        {asarFiles.map((asarFile) => {
          const patchList = patchesByAsar[asarFile] || []
          const state = getPatchState(asarFile)

          return (
            <AccordionItem
              key={asarFile}
              aria-label={asarFile}
              className="rounded-xl border border-pink-100 bg-white px-3"
              isCompact
              title={
                <div className="flex items-center justify-between gap-2 accordion-title">
                  <div className="flex flex-col">
                    <span className="font-medium app-accent-text">{asarFile}</span>
                    <span className="text-[11px] text-gray-500">{state.hasBackup ? '有备份' : ''}</span>
                  </div>
                  {state.hasBackup ? (
                    <Button size="sm" variant="flat" color="primary" onPress={() => handleRestoreBackup(asarFile)}>
                      还原备份
                    </Button>
                  ) : null}
                </div>
              }
            >
              <div className="flex flex-col gap-4 text-xs">
                {patchList.length === 0 ? (
                  <div className="text-[11px] text-gray-500">此 asar 没有补丁。</div>
                ) : (
                  <Accordion isCompact className="sub-accordion">
                    {patchList.map((patch, index) => {
                      const styleSelectors = Object.keys(patch.styleOverridesBySelector || {})
                      const colorKeys = Object.keys(patch.colorOverrides || {})

                      return (
                        <AccordionItem
                          key={index}
                          className="overflow-hidden sub-accordion-item"
                          startContent={
                            <span className="font-medium flex flex-row gap-1 w-full accordion-title">
                              <span>补丁 #{index + 1}</span>
                              <React.Fragment>
                                {patch.description ? ` · ${patch.description}` : ''}
                                <span>·</span>
                                <span className="font-medium text-gray-500">
                                  {patch.kind === 'main-script' ? '主脚本' : '文件'}
                                </span>
                              </React.Fragment>
                            </span>
                          }
                          HeadingComponent="span"
                        >
                          <div
                            key={`${asarFile}-patch-${index}`}
                            className="flex flex-col gap-2 border-t border-pink-100 pt-2"
                          >
                            <div className="font-medium">样式 ({styleSelectors.length})</div>
                            {styleSelectors.map((selector) => {
                              const declarations = patch.styleOverridesBySelector[selector]
                              const entries = Object.entries(declarations)
                              return (
                                <div key={`${asarFile}-selector-${selector}-${index}`} className="mt-1">
                                  <div className="font-mono text-[11px]">{selector}</div>
                                  <div className="text-[11px] text-gray-500 break-all">
                                    {entries.map(([prop, value]) => (
                                      <div key={prop} className="flex items-start gap-1">
                                        <span className="font-mono shrink-0">{prop}:</span>
                                        <ColorPreview value={value} />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )
                            })}

                            <div className="font-medium">颜色 ({colorKeys.length})</div>
                            {colorKeys.map((key) => (
                              <div key={`${asarFile}-color-${key}-${index}`} className="text-[11px]">
                                <span className="font-mono">{key}</span>
                                <span className="mx-1">→</span>
                                <ColorPreview value={patch.colorOverrides[key]} />
                              </div>
                            ))}

                            {patch.customScript ? (
                              <React.Fragment>
                                <div className="font-medium">自定义脚本</div>
                                <div className="text-[11px] text-gray-500 break-all font-mono bg-gray-100 p-2 rounded-md">
                                  {patch.customScript}
                                </div>
                              </React.Fragment>
                            ) : null}
                          </div>
                        </AccordionItem>
                      )
                    })}
                  </Accordion>
                )}
              </div>
            </AccordionItem>
          )
        })}
      </Accordion>
    )
  }

  function renderWorkingState() {
    if (workingState === 'idle') {
      return (
        <div className="flex flex-col gap-3 grow shrink h-full overflow-hidden rounded-2xl bg-pink-50 border border-pink-100 p-4">
          <div className="flex flex-row gap-2 items-center">
            <DoubleCheckButton
              onDoubleChecked={handleKillLark}
              doubleCheckText="确认结束"
              temporaryDisableText="Done"
              size="sm"
              variant="flat"
            >
              结束飞书
            </DoubleCheckButton>
            <Button onPress={handleLoadTheme} variant="flat" size="sm">
              加载主题
            </Button>
            <Button
              onPress={handleApplyPatch}
              disabled={!activeTheme}
              variant="flat"
              size="sm"
              color="primary"
              className="w-full"
            >
              应用补丁
            </Button>
          </div>

          <div className="flex flex-col gap-2 grow shrink h-full overflow-hidden text-sm">
            {hasPendingBackups ? (
              <div className="flex flex-col rounded-xl border border-pink-100 bg-white p-3">
                <span>当前主题有备份可供还原。</span>
                <span className="text-xs text-amber-400 mb-4">还原后，对应部位将变回官方原版。</span>
                <Button onPress={handleRestoreAllBackups} variant="flat" size="sm">
                  一键还原所有备份
                </Button>
              </div>
            ) : null}
            {renderActiveTheme()}
          </div>
        </div>
      )
    }

    if (workingState === 'working') {
      return (
        <div className="flex flex-col items-center justify-center gap-3 grow shrink h-full overflow-hidden rounded-2xl bg-pink-50 border border-pink-100 p-4">
          <Progress value={currentProgress} maxValue={maxProgress} />
          <span className="text-xs text-gray-500">
            {maxProgress === 0 ? '准备中...' : `${Math.round((currentProgress / maxProgress) * 100)}%`}
          </span>
        </div>
      )
    }

    if (workingState === 'done') {
      return (
        <div className="flex flex-col items-center justify-center gap-3 grow shrink h-full overflow-hidden rounded-2xl bg-pink-50 border border-pink-100 p-4">
          <span className="text-gray-500">任务完成~</span>
          <div className="flex flex-row gap-2">
            <Button onPress={handleFinishAndLaunchLark} variant="flat" color="primary" size="sm">
              完成并启动飞书
            </Button>
            <Button onPress={handleFinish} variant="flat" size="sm">
              完成
            </Button>
          </div>
        </div>
      )
    }

    if (workingState === 'error') {
      return (
        <div className="flex flex-col items-center justify-center gap-3 grow shrink h-full overflow-hidden rounded-2xl bg-pink-50 border border-pink-100 p-4">
          <span className="text-gray-500">任务失败</span>
          <Button onPress={handleFinishAndRestoreBackups} variant="flat" size="sm">
            还原备份
          </Button>
        </div>
      )
    }

    return null
  }

  return (
    <main className="min-h-screen app-shell text-slate-800">
      <div className="absolute left-0 top-0 w-full h-full flex flex-row gap-3 p-4">
        {renderWorkingState()}

        <div
          ref={logsContainerRef}
          className="flex flex-col h-full w-[360px] grow-0 shrink-0 overflow-x-hidden overflow-y-auto select-none rounded-2xl bg-white border border-pink-100 p-3"
        >
          {renderLogs(logsStore.logs)}
        </div>
      </div>
    </main>
  )
}

export default App
