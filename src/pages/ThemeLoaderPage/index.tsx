import React, { useEffect, useMemo, useRef } from 'react'
import { Accordion, AccordionItem, Button, Progress, Tooltip } from '@heroui/react'
import { DateTime } from 'luxon'
import classNames from 'classnames'
import { DoubleCheckButton } from '../../components/DoubleCheckButton'
import { Log } from '../../store/logs'
import { isColorLike } from './utils'
import { useThemeLoaderViewModel } from './vm'

export default function ThemeLoaderPage() {
  const vm = useThemeLoaderViewModel()

  const logsContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight
    }
  }, [vm.logs.length])

  const renderActiveTheme = useMemo(() => {
    if (!vm.activeTheme) {
      return (
        <div className="container mx-auto text-center flex flex-col gap-2 items-center justify-center w-full h-full">
          尚未加载主题配置文件。
          <Button onPress={vm.handleLoadTheme} variant="flat" size="sm">
            加载主题
          </Button>
        </div>
      )
    }
    const patchesByAsar = vm.activeTheme.asarPatches
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
          const state = vm.getPatchState(asarFile)

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
                    <Button size="sm" variant="flat" color="primary" onPress={() => vm.handleRestoreBackup(asarFile)}>
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
  }, [vm.activeTheme, vm.getPatchState, vm.handleLoadTheme])

  function renderWorkingState() {
    if (vm.workingState === 'idle') {
      return (
        <div className="flex flex-col gap-3 grow shrink h-full overflow-hidden rounded-2xl bg-pink-50 border border-pink-100 p-4">
          <div className="flex flex-row gap-2 items-center">
            <DoubleCheckButton
              onDoubleChecked={vm.handleKillLark}
              doubleCheckText="确认结束"
              temporaryDisableText="Done"
              size="sm"
              variant="flat"
            >
              结束飞书
            </DoubleCheckButton>
            <Button onPress={vm.handleLoadTheme} variant="flat" size="sm">
              加载主题
            </Button>
            <Button
              onPress={vm.handleApplyPatch}
              disabled={!vm.activeTheme}
              variant="flat"
              size="sm"
              color="primary"
              className="w-full text-pink-700"
            >
              开始应用主题
            </Button>
          </div>

          <div className="flex flex-col gap-2 grow shrink h-full overflow-hidden text-sm overflow-y-auto scrollbar-hide">
            {vm.hasPendingBackups ? (
              <div className="flex flex-col rounded-xl border border-pink-100 bg-white p-3">
                <span>当前主题有备份可供还原。</span>
                <span className="text-xs text-amber-400 mb-4">还原后，对应部位将变回官方原版。</span>
                <Button onPress={vm.handleRestoreAllBackups} variant="flat" size="sm">
                  一键还原所有备份
                </Button>
              </div>
            ) : null}
            {renderActiveTheme}
          </div>
        </div>
      )
    }

    if (vm.workingState === 'working') {
      return (
        <div className="flex flex-col items-center justify-center gap-3 grow shrink h-full overflow-hidden rounded-2xl bg-pink-50 border border-pink-100 p-4">
          <Progress value={vm.currentProgress} maxValue={vm.maxProgress} />
          <span className="text-xs text-gray-500">
            {vm.maxProgress === 0 ? '准备中...' : `${Math.round((vm.currentProgress / vm.maxProgress) * 100)}%`}
          </span>
        </div>
      )
    }

    if (vm.workingState === 'done') {
      return (
        <div className="flex flex-col items-center justify-center gap-3 grow shrink h-full overflow-hidden rounded-2xl bg-pink-50 border border-pink-100 p-4">
          <span className="text-gray-500">任务完成~</span>
          <div className="flex flex-row gap-2">
            <Button onPress={vm.handleFinishAndLaunchLark} variant="flat" color="primary" size="sm">
              完成并启动飞书
            </Button>
            <Button onPress={vm.handleFinish} variant="flat" size="sm">
              完成
            </Button>
          </div>
        </div>
      )
    }

    if (vm.workingState === 'error') {
      return (
        <div className="flex flex-col items-center justify-center gap-3 grow shrink h-full overflow-hidden rounded-2xl bg-pink-50 border border-pink-100 p-4">
          <span className="text-gray-500">任务失败</span>
          <Button onPress={vm.handleFinishAndRestoreBackups} variant="flat" size="sm">
            还原备份
          </Button>
        </div>
      )
    }

    return null
  }

  return (
    <div className="flex flex-row gap-3 w-full">
      {renderWorkingState()}
      <div
        ref={logsContainerRef}
        className="flex flex-col h-full w-[360px] grow-0 shrink-0 overflow-x-hidden overflow-y-auto select-none rounded-2xl bg-white border border-pink-100 p-3"
      >
        {renderLogs(vm.logs)}
      </div>
    </div>
  )
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

function renderLogs(logs: Log[]) {
  const components = []
  for (let index = 0; index < logs.length; index++) {
    const log = logs[index]
    const timeDelta = index === 0 ? 0 : log.timestamp - logs[index - 1].timestamp
    const shouldOmitDisplayDatetime = index !== 0 && timeDelta < 3000

    const displayDatetime = shouldOmitDisplayDatetime ? '' : DateTime.fromMillis(log.timestamp).toFormat('HH:mm:ss')
    const item = (
      <Tooltip
        content={DateTime.fromMillis(log.timestamp).toFormat('yyyy/MM/dd HH:mm:ss')}
        closeDelay={0}
        style={{
          pointerEvents: 'none',
        }}
      >
        <div
          key={index}
          className={classNames(
            'text-[12px] text-gray-600 leading-[14px] flex flex-row',
            index === 0 || shouldOmitDisplayDatetime ? '' : 'mt-2',
            'hover:bg-gray-100 p-1 rounded-md'
          )}
        >
          <div className="w-[80px] shrink-0">{displayDatetime}</div>
          <div className="wrap-anywhere">{log.text}</div>
        </div>
      </Tooltip>
    )
    components.push(item)
  }
  return components
}
