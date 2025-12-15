import React, { useMemo } from 'react'
import { Accordion, AccordionItem, Button, Progress } from '@heroui/react'
import { isColorLike } from './utils'
import { useThemeLoaderViewModel } from './vm'
import './index.scss'

export default function ThemeLoaderPage() {
  const vm = useThemeLoaderViewModel()

  const renderActiveTheme = useMemo(() => {
    if (!vm.activeTheme) {
      return (
        <div className="theme-loader-empty">
          尚未加载主题配置文件。
          <Button onPress={vm.handleLoadTheme} variant="flat" size="sm" className="theme-loader-button">
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
        className="theme-loader-accordion"
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
              className="theme-loader-accordion-item"
              isCompact
              title={
                <div className="flex items-center justify-between gap-2 accordion-title">
                  <div className="flex flex-col theme-loader-accordion-title">
                    <span className="font-medium">{asarFile}</span>
                    <span className="accordion-title">{state.hasBackup ? '有备份' : ''}</span>
                  </div>
                  {state.hasBackup ? (
                    <Button
                      size="sm"
                      variant="flat"
                      color="primary"
                      onPress={() => vm.handleRestoreBackup(asarFile)}
                      className="theme-loader-button"
                    >
                      还原备份
                    </Button>
                  ) : null}
                </div>
              }
            >
              <div className="flex flex-col gap-4 text-xs">
                {patchList.length === 0 ? (
                  <div className="text-[11px]" style={{ color: '#8b6f7e', opacity: 0.7 }}>
                    此 asar 没有补丁。
                  </div>
                ) : (
                  <Accordion isCompact className="sub-accordion">
                    {patchList.map((patch, index) => {
                      const styleSelectors = Object.keys(patch.styleOverridesBySelector || {})
                      const colorKeys = Object.keys(patch.colorOverrides || {})

                      return (
                        <AccordionItem
                          key={index}
                          className="overflow-hidden theme-loader-patch-item"
                          startContent={
                            <span className="font-medium flex flex-row gap-1 w-full accordion-title">
                              <span>补丁 #{index + 1}</span>
                              <React.Fragment>
                                {patch.description ? ` · ${patch.description}` : ''}
                                <span>·</span>
                                <span className="font-medium" style={{ color: '#8b6f7e', opacity: 0.7 }}>
                                  {patch.kind === 'main-script' ? '主脚本' : '文件'}
                                </span>
                              </React.Fragment>
                            </span>
                          }
                          HeadingComponent="span"
                        >
                          <div key={`${asarFile}-patch-${index}`} className="theme-loader-patch-content">
                            <div className="font-medium">样式 ({styleSelectors.length})</div>
                            {styleSelectors.map((selector) => {
                              const declarations = patch.styleOverridesBySelector[selector]
                              const entries = Object.entries(declarations)
                              return (
                                <div key={`${asarFile}-selector-${selector}-${index}`} className="mt-1">
                                  <div className="font-mono text-[11px]" style={{ color: '#8b6f7e' }}>
                                    {selector}
                                  </div>
                                  <div className="text-[11px] break-all" style={{ color: '#8b6f7e', opacity: 0.8 }}>
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
                              <div
                                key={`${asarFile}-color-${key}-${index}`}
                                className="text-[11px]"
                                style={{ color: '#8b6f7e', opacity: 0.8 }}
                              >
                                <span className="font-mono">{key}</span>
                                <span className="mx-1">→</span>
                                <ColorPreview value={patch.colorOverrides[key]} />
                              </div>
                            ))}

                            {patch.customScript ? (
                              <React.Fragment>
                                <div className="font-medium">自定义脚本</div>
                                <div className="theme-loader-code-block">{patch.customScript}</div>
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
        <div className="theme-loader-content">
          <div className="theme-loader-actions">
            <Button onPress={vm.handleLoadTheme} variant="flat" size="sm" className="theme-loader-button">
              加载主题
            </Button>
            <Button
              onPress={vm.handleApplyPatch}
              disabled={!vm.activeTheme}
              variant="flat"
              size="sm"
              color="primary"
              className="theme-loader-button"
              style={{ flex: 1 }}
            >
              开始应用主题
            </Button>
          </div>

          <div className="theme-loader-scroll">
            {vm.hasPendingBackups ? (
              <div className="theme-loader-backup-notice">
                <span>当前主题有备份可供还原。</span>
                <span>还原后，对应部位将变回官方原版。</span>
                <Button onPress={vm.handleRestoreAllBackups} variant="flat" size="sm" className="theme-loader-button">
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
        <div className="theme-loader-state">
          <Progress value={vm.currentProgress} maxValue={vm.maxProgress} />
          <span>
            {vm.maxProgress === 0 ? '准备中...' : `${Math.round((vm.currentProgress / vm.maxProgress) * 100)}%`}
          </span>
        </div>
      )
    }

    if (vm.workingState === 'done') {
      return (
        <div className="theme-loader-state">
          <span>任务完成~</span>
          <div className="flex flex-row gap-2">
            <Button
              onPress={vm.handleFinishAndLaunchLark}
              variant="flat"
              color="primary"
              size="sm"
              className="theme-loader-button"
            >
              完成并启动飞书
            </Button>
            <Button onPress={vm.handleFinish} variant="flat" size="sm" className="theme-loader-button">
              完成
            </Button>
          </div>
        </div>
      )
    }

    if (vm.workingState === 'error') {
      return (
        <div className="theme-loader-state">
          <span>任务失败</span>
          <Button onPress={vm.handleFinishAndRestoreBackups} variant="flat" size="sm" className="theme-loader-button">
            还原备份
          </Button>
        </div>
      )
    }

    return null
  }

  return <div className="theme-loader-page">{renderWorkingState()}</div>
}

function ColorPreview(props: { value: string }) {
  const { value } = props
  if (!isColorLike(value)) {
    return <span>{value}</span>
  }
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block w-3 h-3 rounded border"
        style={{ backgroundColor: value, borderColor: 'rgba(255, 182, 193, 0.3)' }}
      />
      <span>{value}</span>
    </span>
  )
}
