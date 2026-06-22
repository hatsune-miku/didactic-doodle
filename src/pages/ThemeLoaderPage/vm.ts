import { useEffect, useRef } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { makeStylesScript } from '../../helper/style-scripts'
import { LarkSession, nativeBridge } from '../../ports/bridge'
import { useLogsStore } from '../../store/logs'
import { useWindowTitle } from '../../utils/use-title'
import { useThemeEngineStore } from '../../store/theme-engine'
import { useThemeLibraryStore } from '../../store/theme-library'
import { mergeThemes } from '../../theme/merge'

export function useThemeLoaderViewModel() {
  const logsStore = useLogsStore()
  const themeEngineStore = useThemeEngineStore()
  const library = useThemeLibraryStore()

  const windowTitle = useWindowTitle()

  const sessionRef = useRef<LarkSession | null>(null)

  const enabledCount = library.items.filter((item) => item.entry.enabled).length

  async function ensureSession(): Promise<LarkSession> {
    if (sessionRef.current) {
      return sessionRef.current
    }
    const session = await nativeBridge.createLarkSession()
    sessionRef.current = session
    return session
  }

  async function handleApply() {
    if (await nativeBridge.isLarkRunning()) {
      logsStore.add('飞书正在运行，请先关闭')
      return
    }

    // 对账式应用：先把所有备份还原回官方原版，再把当前勾选的合并应用上去。
    // 因此「不勾选任何主题 + 应用」= 纯还原 = 官方原版。
    const themes = await library.collectEnabledThemes()
    const merged = mergeThemes(themes)
    const entries = Object.entries(merged.asarPatches).filter(([, patches]) => patches && patches.length > 0)

    themeEngineStore.setWorkingState('working')
    try {
      themeEngineStore.setCurrentProgress(0)
      themeEngineStore.setMaxProgress(entries.length + 1)

      const session = await ensureSession()
      logsStore.add('正在还原到官方原版...')
      try {
        await session.restoreAllBackups()
      } catch (error) {
        logsStore.add(`还原失败: ${String(error)}`)
      }
      themeEngineStore.incrementCurrentProgress()

      for (const [asarFile, patches] of entries) {
        logsStore.add(`正在修改 asar 文件: ${asarFile}`)

        for (let index = 0; index < patches.length; index++) {
          logsStore.add(`补丁 #${index + 1} 开始应用...`)
          const patch = patches[index]
          const script = makeStylesScript(patch)

          if (patch.kind === 'main-script') {
            await session.submitMainScriptPatch({ asarPath: asarFile, subject: patch.subject, script })
          } else {
            await session.submitPatch({ asarPath: asarFile, innerPath: patch.path, script })
          }
        }

        logsStore.add('正在写入文件...')
        try {
          await session.applyPatches()
        } catch (error) {
          logsStore.add(`写入文件失败: ${String(error)}`)
        }
        themeEngineStore.incrementCurrentProgress()
      }
      themeEngineStore.setCurrentProgress(themeEngineStore.maxProgress)
      themeEngineStore.setWorkingState('done')
    } catch (error) {
      themeEngineStore.setCurrentProgress(0)
      themeEngineStore.setWorkingState('error')
      logsStore.add(`应用补丁失败: ${String(error)}`)
    }

    logsStore.add('=== 任务结束 ===')
  }

  async function handleRestoreAllBackups() {
    if (await nativeBridge.isLarkRunning()) {
      logsStore.add('飞书正在运行，请先关闭')
      return
    }
    try {
      const session = await ensureSession()
      await session.restoreAllBackups()
      logsStore.add('所有备份已恢复')
    } catch (error) {
      logsStore.add(`恢复备份失败: ${String(error)}`)
    }
  }

  function handleImport() {
    return library.importTheme()
  }

  function handleRemove(id: string) {
    return library.removeTheme(id)
  }

  function handleToggle(id: string) {
    return library.toggleEnabled(id)
  }

  function handleReorder(orderedIds: string[]) {
    return library.reorder(orderedIds)
  }

  function handleFinishAndLaunchLark() {
    nativeBridge.launchLark()
    themeEngineStore.setWorkingState('idle')
  }

  function handleFinishAndRestoreBackups() {
    handleRestoreAllBackups()
    themeEngineStore.setWorkingState('idle')
  }

  function handleFinish() {
    themeEngineStore.setWorkingState('idle')
  }

  useEffect(() => {
    getCurrentWindow()?.setTitle(windowTitle || '')
  }, [windowTitle])

  useEffect(() => {
    library.load()
    nativeBridge.getLarkBasePath().then((path) => {
      logsStore.add(`找到飞书路径: ${path}`)
    })
    const unsubscribe = nativeBridge.subscribeToLogEvents((message) => {
      logsStore.add(message)
    })
    return () => {
      unsubscribe.then((unsubscribe) => unsubscribe())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    workingState: themeEngineStore.workingState,
    currentProgress: themeEngineStore.currentProgress,
    maxProgress: themeEngineStore.maxProgress,
    items: library.items,
    enabledCount,
    handleImport,
    handleApply,
    handleRemove,
    handleToggle,
    handleReorder,
    handleRestoreAllBackups,
    handleFinishAndLaunchLark,
    handleFinishAndRestoreBackups,
    handleFinish,
  }
}
