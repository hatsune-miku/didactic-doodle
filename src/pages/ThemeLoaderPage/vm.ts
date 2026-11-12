import { useEffect, useRef, useState } from 'react'

import { openUrl } from '@tauri-apps/plugin-opener'

import { nativeBridge } from '../../ports/bridge'
import { useLogsStore } from '../../store/logs'
import { useThemeEngineStore } from '../../store/theme-engine'
import { useThemeLibraryStore } from '../../store/theme-library'
import { applyEnabledThemes, restoreOfficialTheme } from '../../theme/operations'
import { useWindowTitle } from '../../utils/use-title'

export function useThemeLoaderViewModel() {
  const engine = useThemeEngineStore()
  const library = useThemeLibraryStore()
  const [libraryBusy, setLibraryBusy] = useState(false)
  const [libraryError, setLibraryError] = useState<string | null>(null)
  const busyRef = useRef(false)
  const retryRef = useRef<(() => Promise<void>) | null>(null)
  useWindowTitle()

  async function runLibraryAction(action: () => Promise<void>) {
    if (busyRef.current || useThemeEngineStore.getState().workingState === 'working') return
    busyRef.current = true
    setLibraryBusy(true)
    setLibraryError(null)
    retryRef.current = action
    try {
      await action()
      retryRef.current = null
    } catch (error) {
      setLibraryError(String(error))
      useLogsStore.getState().add(String(error))
    } finally {
      busyRef.current = false
      setLibraryBusy(false)
    }
  }

  function handleImport() {
    return runLibraryAction(library.importTheme)
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
  function handleRetryLibrary() {
    if (retryRef.current) return runLibraryAction(retryRef.current)
  }
  function handleOpenEditor() {
    return runLibraryAction(() => openUrl('https://wal-theme.vanillacake.cn/'))
  }
  function handleRetryOperation() {
    return engine.lastOperation === 'restore' ? restoreOfficialTheme() : applyEnabledThemes()
  }
  function handleDismissStatus() {
    engine.setLastError(null)
    engine.setCompletionMessage(null)
    engine.setWorkingState('idle')
  }
  function handleLaunch() {
    return runLibraryAction(() => nativeBridge.launchLark())
  }

  useEffect(() => {
    runLibraryAction(library.load)
    nativeBridge
      .getLarkBasePath()
      .then((path) => useLogsStore.getState().add(`找到飞书: ${path}`))
      .catch((error) => useLogsStore.getState().add(`定位飞书失败: ${String(error)}`))
    const subscription = nativeBridge.subscribeToLogEvents((message) => useLogsStore.getState().add(message))
    subscription.catch((error) => useLogsStore.getState().add(`订阅运行记录失败: ${String(error)}`))
    return () => {
      subscription.then((unsubscribe) => unsubscribe()).catch(() => {})
    }
  }, [])

  return {
    ...engine,
    items: library.items,
    loaded: library.loaded,
    enabledCount: library.items.filter((item) => item.entry.enabled).length,
    disabled: libraryBusy || engine.workingState === 'working',
    libraryBusy,
    libraryError,
    handleImport,
    handleRemove,
    handleToggle,
    handleReorder,
    handleOpenEditor,
    handleRetryLibrary,
    handleRetryOperation,
    handleDismissStatus,
    handleLaunch,
    handleApply: applyEnabledThemes,
    handleRestore: restoreOfficialTheme,
  }
}
