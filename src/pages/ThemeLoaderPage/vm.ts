import { useEffect, useRef, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { makeStylesScript } from '../../helper/style-scripts'
import { LarkSession, nativeBridge } from '../../ports/bridge'
import { promptAndLoadTheme } from '../../theme'
import { WalTheme } from '../../theme/types'
import { useLogsStore } from '../../store/logs'
import { joinPath } from '../../utils/path'
import { useWindowTitle } from '../../utils/use-title'

export interface PatchState {
  hasBackup: boolean
}

export type WorkingState = 'idle' | 'working' | 'done' | 'error'

export function useThemeLoaderViewModel() {
  const logsStore = useLogsStore()
  const windowTitle = useWindowTitle()

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
          logsStore.add(`补丁 #${index + 1} 开始应用...`)
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

        logsStore.add('正在写入文件...')
        try {
          await session.applyPatches()
        } catch (error) {
          logsStore.add(`写入文件失败: ${String(error)}`)
        }
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

  useEffect(() => {
    getCurrentWindow()?.setTitle(windowTitle || '')
  }, [windowTitle])

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

  return {
    logs: logsStore.logs,
    workingState,
    activeTheme,
    hasPendingBackups,
    currentProgress,
    maxProgress,
    handleKillLark,
    handleLoadTheme,
    handleApplyPatch,
    handleRestoreAllBackups,
    handleRestoreBackup,
    handleFinishAndLaunchLark,
    handleFinishAndRestoreBackups,
    handleFinish,
    getPatchState,
  }
}
