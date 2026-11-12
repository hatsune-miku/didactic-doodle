import { useEffect, useRef, useState } from 'react'

import { openUrl } from '@tauri-apps/plugin-opener'

import { nativeBridge } from '../ports/bridge'
import { useLogsStore } from '../store/logs'
import { ThemeOperation, useThemeEngineStore } from '../store/theme-engine'
import { useThemeLibraryStore } from '../store/theme-library'
import { applyEnabledThemes, restoreOfficialTheme } from '../theme/operations'
import { useLarkRunning } from '../utils/use-lark-running'
import { useWindowTitle } from '../utils/use-title'

const THEME_EDITOR_URL = 'https://wal-theme.vanillacake.cn/'
const EXIT_TIMEOUT = 15000

/** 退出飞书的来由：单纯退出，或退出后继续应用 / 恢复。 */
export type ExitIntent = 'exit' | ThemeOperation
export type InspectorTab = 'detail' | 'log'

function log(message: string) {
  useLogsStore.getState().add(message)
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForLarkExit() {
  const deadline = Date.now() + EXIT_TIMEOUT
  while (await nativeBridge.isLarkRunning()) {
    if (Date.now() > deadline) {
      throw new Error(`飞书在 ${EXIT_TIMEOUT / 1000} 秒内没有退出，可能仍在保存数据。`)
    }
    await delay(400)
  }
}

export function useWorkspace() {
  const engine = useThemeEngineStore()
  const library = useThemeLibraryStore()
  const lark = useLarkRunning()
  const [libraryBusy, setLibraryBusy] = useState(false)
  const [libraryError, setLibraryError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('detail')
  const [exitIntent, setExitIntent] = useState<ExitIntent | null>(null)
  const [exiting, setExiting] = useState(false)
  const [exitError, setExitError] = useState<string | null>(null)
  const [launching, setLaunching] = useState(false)
  const [launchError, setLaunchError] = useState<string | null>(null)
  const busyRef = useRef(false)
  const exitingRef = useRef(false)
  const retryRef = useRef<(() => Promise<void>) | null>(null)
  useWindowTitle()

  const working = engine.workingState === 'working'
  const disabled = libraryBusy || working || exiting
  const selected = library.items.find((item) => item.entry.id === selectedId) ?? library.items[0] ?? null
  const selectedIndex = selected ? library.items.indexOf(selected) : -1

  async function runLibraryAction(action: () => Promise<void>) {
    if (busyRef.current || exitingRef.current || useThemeEngineStore.getState().workingState === 'working') return
    busyRef.current = true
    setLibraryBusy(true)
    setLibraryError(null)
    retryRef.current = action
    try {
      await action()
      retryRef.current = null
    } catch (error) {
      setLibraryError(String(error))
      log(String(error))
    } finally {
      busyRef.current = false
      setLibraryBusy(false)
    }
  }

  function handleImport() {
    return runLibraryAction(async () => {
      const before = new Set(useThemeLibraryStore.getState().items.map((item) => item.entry.id))
      await library.importTheme()
      // 新导入的主题直接显示详情，覆盖导入则保持当前选择。
      const added = useThemeLibraryStore.getState().items.find((item) => !before.has(item.entry.id))
      if (added) {
        setSelectedId(added.entry.id)
        setInspectorTab('detail')
      }
    })
  }
  function handleRemove(id: string) {
    return runLibraryAction(() => library.removeTheme(id))
  }
  function handleToggle(id: string) {
    return runLibraryAction(() => library.toggleEnabled(id))
  }
  function handleReorder(ids: string[]) {
    return runLibraryAction(() => library.reorder(ids))
  }
  function handleMove(id: string, offset: number) {
    const ids = library.items.map((item) => item.entry.id)
    const index = ids.indexOf(id)
    const next = index + offset
    if (index < 0 || next < 0 || next >= ids.length) return
    ;[ids[index], ids[next]] = [ids[next], ids[index]]
    return handleReorder(ids)
  }
  function handleRetryLibrary() {
    if (retryRef.current) return runLibraryAction(retryRef.current)
  }
  function handleDismissLibraryError() {
    setLibraryError(null)
    retryRef.current = null
  }
  function handleOpenEditor() {
    return runLibraryAction(() => openUrl(THEME_EDITOR_URL))
  }
  function handleSelect(id: string) {
    setSelectedId(id)
    setInspectorTab('detail')
  }

  /** 应用或恢复前先确认飞书已退出；仍在运行时改为询问是否退出飞书后继续。 */
  async function runThemeOperation(operation: ThemeOperation) {
    if (disabled) return
    let running = false
    try {
      running = await nativeBridge.isLarkRunning()
    } catch {
      // 读取失败时交给后续操作：它会再次检查进程状态，并把真实错误显示在操作结果中。
    }
    if (running) {
      setExitError(null)
      setExitIntent(operation)
      return
    }
    if (operation === 'apply') await applyEnabledThemes()
    else await restoreOfficialTheme()
  }

  function handleRequestExit() {
    setExitError(null)
    setExitIntent('exit')
  }
  function handleCancelExit() {
    if (exitingRef.current) return
    setExitIntent(null)
    setExitError(null)
  }
  async function handleConfirmExit() {
    const intent = exitIntent
    if (!intent || exitingRef.current) return
    exitingRef.current = true
    setExiting(true)
    setExitError(null)
    try {
      await nativeBridge.killLark()
      await waitForLarkExit()
      log('飞书已退出')
      setExitIntent(null)
    } catch (error) {
      const message = `退出飞书失败: ${String(error)}`
      setExitError(message)
      log(message)
      return
    } finally {
      exitingRef.current = false
      setExiting(false)
      lark.refresh()
    }
    if (intent === 'apply') await applyEnabledThemes()
    if (intent === 'restore') await restoreOfficialTheme()
  }

  async function handleLaunch() {
    if (launching) return
    setLaunching(true)
    setLaunchError(null)
    try {
      await nativeBridge.launchLark()
      log('已启动飞书')
    } catch (error) {
      const message = `启动飞书失败: ${String(error)}`
      setLaunchError(message)
      log(message)
    } finally {
      setLaunching(false)
      lark.refresh()
    }
  }

  function handleDismissStatus() {
    engine.setLastError(null)
    engine.setCompletionMessage(null)
    if (engine.workingState !== 'working') engine.setWorkingState('idle')
  }

  useEffect(() => {
    runLibraryAction(library.load)
    nativeBridge
      .getLarkBasePath()
      .then((path) => log(`找到飞书: ${path}`))
      .catch((error) => log(`定位飞书失败: ${String(error)}`))
    const subscription = nativeBridge.subscribeToLogEvents(log)
    subscription.catch((error) => log(`订阅运行记录失败: ${String(error)}`))
    return () => {
      subscription.then((unsubscribe) => unsubscribe()).catch(() => {})
    }
  }, [])

  return {
    engine,
    lark: {
      running: lark.running,
      error: lark.error,
      launching,
      launchError,
      exitIntent,
      exiting,
      exitError,
    },
    items: library.items,
    loaded: library.loaded,
    enabledCount: library.items.filter((item) => item.entry.enabled).length,
    selected,
    selectedIndex,
    inspectorTab,
    disabled,
    libraryBusy,
    libraryError,
    setInspectorTab,
    handleSelect,
    handleImport,
    handleRemove,
    handleToggle,
    handleReorder,
    handleMove,
    handleRetryLibrary,
    handleDismissLibraryError,
    handleOpenEditor,
    handleApply: () => runThemeOperation('apply'),
    handleRestore: () => runThemeOperation('restore'),
    handleRetryOperation: () => runThemeOperation(engine.lastOperation),
    handleDismissStatus,
    handleRequestExit,
    handleCancelExit,
    handleConfirmExit,
    handleLaunch,
    handleDismissLaunchError: () => setLaunchError(null),
  }
}

export type Workspace = ReturnType<typeof useWorkspace>
