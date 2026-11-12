import { mergeThemes } from './merge'

import { makeStylesScript } from '../helper/style-scripts'
import { nativeBridge } from '../ports/bridge'
import { useLogsStore } from '../store/logs'
import { ThemeOperation, useThemeEngineStore } from '../store/theme-engine'
import { useThemeLibraryStore } from '../store/theme-library'

function showAppManagementPermission(error: unknown, action: ThemeOperation): boolean {
  if (!String(error).includes('APP_MANAGEMENT_REQUIRED:')) return false
  useThemeEngineStore.getState().setPermissionAction(action)
  useLogsStore.getState().add('请在系统设置 → 隐私与安全性 → App 管理中允许 wal-assistant-lark，然后重试')
  return true
}

async function checkWriteAccess(action: ThemeOperation): Promise<boolean> {
  try {
    await nativeBridge.checkLarkWriteAccess()
    return true
  } catch (error) {
    if (showAppManagementPermission(error, action)) return false
    throw error
  }
}

export async function retryPendingThemeOperation() {
  const engine = useThemeEngineStore.getState()
  if (engine.workingState === 'working') return
  const action = engine.permissionAction
  engine.setPermissionAction(null)
  if (action === 'apply') await applyEnabledThemes()
  if (action === 'restore') await restoreOfficialTheme()
}

export async function applyEnabledThemes() {
  const engine = useThemeEngineStore.getState()
  if (engine.workingState === 'working') {
    return
  }

  const previousState = engine.workingState
  const log = useLogsStore.getState().add
  // 在第一次异步调用前占用工作状态，避免连按「应用」启动多个写入任务。
  engine.setWorkingState('working')
  engine.setLastOperation('apply')
  engine.setLastError(null)
  engine.setCompletionMessage(null)
  engine.setCurrentProgress(0)
  engine.setMaxProgress(0)

  try {
    if (await nativeBridge.isLarkRunning()) {
      log('飞书正在运行，请先关闭')
      engine.setLastError('飞书正在运行，请先退出飞书，再应用主题。')
      engine.setWorkingState('idle')
      return
    }

    if (!(await checkWriteAccess('apply'))) {
      engine.setWorkingState(previousState)
      return
    }

    const themes = await useThemeLibraryStore.getState().collectEnabledThemes()
    const merged = mergeThemes(themes)
    const entries = Object.entries(merged.asarPatches).filter(([, patches]) => patches.length > 0)
    const maxProgress = entries.length > 0 ? entries.length + 2 : 1
    engine.setMaxProgress(maxProgress)

    // 每次应用使用独立会话，先恢复原版，再应用当前勾选项；空选项只执行恢复。
    await nativeBridge.withLarkSession(async (session) => {
      log('正在还原到官方原版...')
      await session.restoreAllBackups()
      engine.incrementCurrentProgress()

      for (const [asarFile, patches] of entries) {
        log(`正在修改 asar 文件: ${asarFile}`)
        for (const [index, patch] of patches.entries()) {
          log(`补丁 #${index + 1} 开始应用...`)
          const script = makeStylesScript(patch)
          if (patch.kind === 'main-script') {
            await session.submitMainScriptPatch({ asarPath: asarFile, subject: patch.subject, script })
          } else {
            await session.submitPatch({ asarPath: asarFile, innerPath: patch.path, script })
          }
        }

        engine.incrementCurrentProgress()
      }

      if (entries.length > 0) {
        log('正在写入文件...')
        await session.applyPatches()
        engine.incrementCurrentProgress()
      }
    })

    engine.setCurrentProgress(maxProgress)
    engine.setWorkingState('done')
    engine.setCompletionMessage(entries.length > 0 ? '主题已应用' : '已恢复原版')
  } catch (error) {
    engine.setWorkingState('error')
    engine.setLastError(String(error))
    showAppManagementPermission(error, 'apply')
    log(`应用补丁失败: ${String(error)}`)
  } finally {
    log('=== 任务结束 ===')
  }
}

export async function restoreOfficialTheme() {
  const engine = useThemeEngineStore.getState()
  if (engine.workingState === 'working') {
    return
  }

  const previousState = engine.workingState
  const log = useLogsStore.getState().add
  engine.setWorkingState('working')
  engine.setLastOperation('restore')
  engine.setLastError(null)
  engine.setCompletionMessage(null)
  engine.setCurrentProgress(0)
  engine.setMaxProgress(1)

  try {
    if (await nativeBridge.isLarkRunning()) {
      log('飞书正在运行，请先关闭')
      engine.setLastError('飞书正在运行，请先退出飞书，再恢复原版。')
      engine.setWorkingState(previousState)
      return
    }

    if (!(await checkWriteAccess('restore'))) {
      engine.setWorkingState(previousState)
      return
    }

    await nativeBridge.withLarkSession((session) => session.restoreAllBackups())
    log('所有备份已恢复')
    engine.setCompletionMessage('已恢复原版')
    engine.setCurrentProgress(1)
    engine.setWorkingState('idle')
  } catch (error) {
    engine.setWorkingState('error')
    engine.setLastError(String(error))
    showAppManagementPermission(error, 'restore')
    log(`恢复备份失败: ${String(error)}`)
  }
}
