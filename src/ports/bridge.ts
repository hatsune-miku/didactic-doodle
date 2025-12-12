import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getVersion } from '@tauri-apps/api/app'

export type LarkSessionId = string

export interface SubmitPatchPayload {
  asarPath: string
  innerPath: string
  script: string
}

export interface SubmitMainScriptPatchPayload {
  asarPath: string
  subject: string
  script: string
}

export class LarkSession {
  private readonly id: LarkSessionId
  private readonly nativeBridge: NativeBridge

  constructor(id: LarkSessionId, nativeBridge: NativeBridge) {
    this.id = id
    this.nativeBridge = nativeBridge
  }

  submitPatch(payload: SubmitPatchPayload): Promise<void> {
    return this.nativeBridge.invokeLarkSession(this.id, 'submit_patch', [
      payload.asarPath,
      payload.innerPath,
      payload.script,
    ])
  }

  submitMainScriptPatch(payload: SubmitMainScriptPatchPayload): Promise<void> {
    return this.nativeBridge.invokeLarkSession(this.id, 'submit_main_script_patch', [
      payload.asarPath,
      payload.subject,
      payload.script,
    ])
  }

  applyPatches(): Promise<void> {
    return this.nativeBridge.invokeLarkSession(this.id, 'apply_patches', [])
  }

  async backupExists(path: string): Promise<boolean> {
    return (await this.nativeBridge.invokeLarkSession(this.id, 'backup_exists', [path])) === 'true'
  }

  restoreBackup(path: string): Promise<void> {
    return this.nativeBridge.invokeLarkSession(this.id, 'restore_backup', [path])
  }

  createBackup(path: string): Promise<void> {
    return this.nativeBridge.invokeLarkSession(this.id, 'create_backup', [path])
  }
}

export class NativeBridge {
  createLarkSession(): Promise<LarkSession> {
    return invoke<string>('create_lark_session').then((id) => new LarkSession(id, this))
  }

  invokeLarkSession<T>(id: LarkSessionId, command: string, args: string[]): Promise<T> {
    return invoke('invoke_lark_session', { id, command, args })
  }

  isLarkRunning(): Promise<boolean> {
    return invoke<boolean>('is_lark_running')
  }

  killLark(): Promise<void> {
    return invoke('kill_lark')
  }

  waitUntilLarkEnded(): Promise<void> {
    return invoke('wait_until_lark_ended')
  }

  getLarkBasePath(): Promise<string> {
    return invoke<string>('get_lark_base_path')
  }

  launchLark(): Promise<void> {
    return invoke('launch_lark')
  }

  subscribeToLogEvents(callback: (message: string) => void): ReturnType<typeof listen<string>> {
    return listen<string>('log-events', (event) => {
      callback(event.payload)
    })
  }
}

export function getAppVersion(): Promise<string> {
  return getVersion()
}

export const nativeBridge = new NativeBridge()
