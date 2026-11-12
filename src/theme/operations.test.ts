import { beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnabledThemes, restoreOfficialTheme, retryPendingThemeOperation } from './operations'
import { WalTheme } from './types'

import { LarkSession, nativeBridge } from '../ports/bridge'
import { useLogsStore } from '../store/logs'
import { useThemeEngineStore } from '../store/theme-engine'
import { useThemeLibraryStore } from '../store/theme-library'

function theme(asar: string, script: string): WalTheme {
  return {
    asarPatches: {
      [asar]: [
        {
          kind: 'main-script',
          subject: 'main',
          styleOverridesBySelector: {},
          colorOverrides: {},
          enableDevTools: false,
          customScript: script,
        },
      ],
    },
  }
}

function commands() {
  return vi.mocked(nativeBridge.invokeLarkSession).mock.calls.map(([, command]) => command)
}

describe('theme operations', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useLogsStore.getState().clear()
    useThemeEngineStore.setState({ workingState: 'idle', currentProgress: 0, maxProgress: 0, permissionAction: null })
    let sessionCount = 0
    vi.spyOn(nativeBridge, 'createLarkSession').mockImplementation(async () => {
      sessionCount += 1
      return new LarkSession(`session-${sessionCount}`, nativeBridge)
    })
    vi.spyOn(nativeBridge, 'closeLarkSession').mockResolvedValue(undefined)
    vi.spyOn(nativeBridge, 'invokeLarkSession').mockResolvedValue(undefined)
    vi.spyOn(nativeBridge, 'isLarkRunning').mockResolvedValue(false)
    vi.spyOn(nativeBridge, 'checkLarkWriteAccess').mockResolvedValue(undefined)
    vi.spyOn(useThemeLibraryStore.getState(), 'collectEnabledThemes').mockResolvedValue([theme('a.asar', 'FIRST')])
  })

  it('finishes at the current operation maximum and closes the session', async () => {
    await applyEnabledThemes()

    expect(useThemeEngineStore.getState()).toMatchObject({
      workingState: 'done',
      currentProgress: 3,
      maxProgress: 3,
    })
    expect(commands()).toEqual(['restore_all_backups', 'submit_main_script_patch', 'apply_patches'])
    expect(nativeBridge.closeLarkSession).toHaveBeenCalledWith('session-1')
  })

  it('uses a fresh session and the current selection on the next application', async () => {
    await applyEnabledThemes()
    vi.mocked(useThemeLibraryStore.getState().collectEnabledThemes).mockResolvedValue([theme('b.asar', 'SECOND')])
    await applyEnabledThemes()

    expect(nativeBridge.createLarkSession).toHaveBeenCalledTimes(2)
    const nextCalls = vi.mocked(nativeBridge.invokeLarkSession).mock.calls.filter(([id]) => id === 'session-2')
    expect(nextCalls.map(([, command]) => command)).toEqual([
      'restore_all_backups',
      'submit_main_script_patch',
      'apply_patches',
    ])
    expect(nextCalls[1][2]).toEqual(['b.asar', 'main', expect.stringContaining('SECOND')])
    expect(nativeBridge.closeLarkSession).toHaveBeenCalledTimes(2)
  })

  it('only restores the original files when no themes are enabled', async () => {
    vi.mocked(useThemeLibraryStore.getState().collectEnabledThemes).mockResolvedValue([])
    await applyEnabledThemes()

    expect(commands()).toEqual(['restore_all_backups'])
    expect(useThemeEngineStore.getState()).toMatchObject({
      workingState: 'done',
      currentProgress: 1,
      maxProgress: 1,
    })
  })

  it('stops before submitting patches if restoring the originals fails', async () => {
    vi.mocked(nativeBridge.invokeLarkSession).mockRejectedValueOnce(new Error('restore failed'))
    await applyEnabledThemes()

    expect(commands()).toEqual(['restore_all_backups'])
    expect(useThemeEngineStore.getState().workingState).toBe('error')
    expect(nativeBridge.closeLarkSession).toHaveBeenCalledOnce()
    expect(useLogsStore.getState().logs.some((log) => log.text.includes('restore failed'))).toBe(true)
  })

  it('submits all archives before one native commit and reports write failures', async () => {
    vi.mocked(useThemeLibraryStore.getState().collectEnabledThemes).mockResolvedValue([
      theme('b.asar', 'SECOND'),
      theme('a.asar', 'FIRST'),
    ])
    vi.mocked(nativeBridge.invokeLarkSession).mockImplementation(async (_id, command) => {
      if (command === 'apply_patches') {
        throw new Error('write failed')
      }
    })
    await applyEnabledThemes()

    expect(commands()).toEqual([
      'restore_all_backups',
      'submit_main_script_patch',
      'submit_main_script_patch',
      'apply_patches',
    ])
    expect(useThemeEngineStore.getState()).toMatchObject({
      workingState: 'error',
      currentProgress: 3,
      maxProgress: 4,
    })
    expect(nativeBridge.closeLarkSession).toHaveBeenCalledOnce()
  })

  it('never writes prepared archives if a later theme target is invalid', async () => {
    vi.mocked(useThemeLibraryStore.getState().collectEnabledThemes).mockResolvedValue([
      theme('a.asar', 'FIRST'),
      theme('missing.asar', 'SECOND'),
    ])
    vi.mocked(nativeBridge.invokeLarkSession).mockImplementation(async (_id, command, args) => {
      if (command === 'submit_main_script_patch' && args[0] === 'missing.asar') {
        throw new Error('missing archive')
      }
    })
    await applyEnabledThemes()
    expect(commands()).not.toContain('apply_patches')
    expect(useThemeEngineStore.getState().workingState).toBe('error')
    expect(nativeBridge.closeLarkSession).toHaveBeenCalledOnce()
  })

  it('reports errors while reading the theme library before a session is created', async () => {
    vi.mocked(useThemeLibraryStore.getState().collectEnabledThemes).mockRejectedValueOnce(new Error('read failed'))
    await applyEnabledThemes()

    expect(useThemeEngineStore.getState().workingState).toBe('error')
    expect(nativeBridge.createLarkSession).not.toHaveBeenCalled()
  })

  it('does not modify files while Feishu is running', async () => {
    vi.mocked(nativeBridge.isLarkRunning).mockResolvedValueOnce(true)
    await applyEnabledThemes()

    expect(useThemeEngineStore.getState().workingState).toBe('idle')
    expect(nativeBridge.createLarkSession).not.toHaveBeenCalled()
  })

  it('prevents a second application or restore while the first operation is pending', async () => {
    let release!: (running: boolean) => void
    vi.mocked(nativeBridge.isLarkRunning).mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve
      })
    )
    const first = applyEnabledThemes()
    await applyEnabledThemes()
    await restoreOfficialTheme()
    expect(nativeBridge.isLarkRunning).toHaveBeenCalledOnce()

    release(false)
    await first
    expect(nativeBridge.createLarkSession).toHaveBeenCalledOnce()
  })

  it('keeps a failed recovery in the error state until a retry succeeds', async () => {
    useThemeEngineStore.setState({ workingState: 'error' })
    vi.mocked(nativeBridge.invokeLarkSession).mockRejectedValueOnce(new Error('restore failed'))
    await restoreOfficialTheme()
    expect(useThemeEngineStore.getState().workingState).toBe('error')

    await restoreOfficialTheme()
    expect(useThemeEngineStore.getState().workingState).toBe('idle')
    expect(nativeBridge.closeLarkSession).toHaveBeenCalledTimes(2)
  })

  it('keeps recovery available when Feishu is running', async () => {
    useThemeEngineStore.setState({ workingState: 'error' })
    vi.mocked(nativeBridge.isLarkRunning).mockResolvedValueOnce(true)
    await restoreOfficialTheme()

    expect(useThemeEngineStore.getState().workingState).toBe('error')
    expect(nativeBridge.createLarkSession).not.toHaveBeenCalled()
  })

  it('does not claim success when closing the session fails', async () => {
    vi.mocked(nativeBridge.closeLarkSession).mockRejectedValueOnce(new Error('close failed'))
    await applyEnabledThemes()

    expect(useThemeEngineStore.getState().workingState).toBe('error')
  })

  it('guides App Management consent before reading themes or creating a write session', async () => {
    vi.mocked(nativeBridge.checkLarkWriteAccess).mockRejectedValueOnce('APP_MANAGEMENT_REQUIRED: denied')
    await applyEnabledThemes()

    expect(useThemeEngineStore.getState()).toMatchObject({ workingState: 'idle', permissionAction: 'apply' })
    expect(useThemeLibraryStore.getState().collectEnabledThemes).not.toHaveBeenCalled()
    expect(nativeBridge.createLarkSession).not.toHaveBeenCalled()

    await retryPendingThemeOperation()
    expect(nativeBridge.checkLarkWriteAccess).toHaveBeenCalledTimes(2)
    expect(commands()).toEqual(['restore_all_backups', 'submit_main_script_patch', 'apply_patches'])
    expect(useThemeEngineStore.getState()).toMatchObject({ workingState: 'done', permissionAction: null })
  })

  it('retries the pending restore without applying enabled themes', async () => {
    useThemeEngineStore.setState({ workingState: 'error' })
    vi.mocked(nativeBridge.checkLarkWriteAccess).mockRejectedValueOnce('APP_MANAGEMENT_REQUIRED: denied')
    await restoreOfficialTheme()

    expect(useThemeEngineStore.getState()).toMatchObject({ workingState: 'error', permissionAction: 'restore' })
    expect(nativeBridge.createLarkSession).not.toHaveBeenCalled()

    await retryPendingThemeOperation()
    expect(commands()).toEqual(['restore_all_backups'])
    expect(useThemeEngineStore.getState()).toMatchObject({ workingState: 'idle', permissionAction: null })
  })

  it('checks again on retry and keeps guiding while access is denied', async () => {
    vi.mocked(nativeBridge.checkLarkWriteAccess).mockRejectedValue('APP_MANAGEMENT_REQUIRED: denied')
    await applyEnabledThemes()
    await retryPendingThemeOperation()

    expect(useThemeEngineStore.getState()).toMatchObject({ workingState: 'idle', permissionAction: 'apply' })
    expect(nativeBridge.createLarkSession).not.toHaveBeenCalled()
  })

  it('also guides consent if App Management blocks the final write', async () => {
    vi.mocked(nativeBridge.invokeLarkSession).mockImplementation(async (_id, command) => {
      if (command === 'apply_patches') throw 'APP_MANAGEMENT_REQUIRED: denied'
    })
    await applyEnabledThemes()

    expect(useThemeEngineStore.getState()).toMatchObject({ workingState: 'error', permissionAction: 'apply' })
    expect(nativeBridge.closeLarkSession).toHaveBeenCalledOnce()
  })

  it('reports ordinary preflight failures without displaying permission guidance', async () => {
    vi.mocked(nativeBridge.checkLarkWriteAccess).mockRejectedValueOnce(new Error('missing directory'))
    await applyEnabledThemes()

    expect(useThemeEngineStore.getState()).toMatchObject({ workingState: 'error', permissionAction: null })
    expect(nativeBridge.createLarkSession).not.toHaveBeenCalled()
    expect(useLogsStore.getState().logs.some((log) => log.text.includes('missing directory'))).toBe(true)
  })

  it('does not resume an operation after dismissing the permission guide', async () => {
    vi.mocked(nativeBridge.checkLarkWriteAccess).mockRejectedValueOnce('APP_MANAGEMENT_REQUIRED: denied')
    await applyEnabledThemes()
    useThemeEngineStore.getState().setPermissionAction(null)
    await retryPendingThemeOperation()

    expect(nativeBridge.checkLarkWriteAccess).toHaveBeenCalledOnce()
    expect(nativeBridge.createLarkSession).not.toHaveBeenCalled()
  })
})
