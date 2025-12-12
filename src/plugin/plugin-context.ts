import { LarkSession, nativeBridge } from '../ports/bridge'
import { useLogsStore } from '../store/logs'

export interface PluginContext {
  log: (message: string) => void
  session: LarkSession
}

export async function createPluginContext() {
  const createLog = useLogsStore.getState().add

  return {
    log: createLog,
    session: await nativeBridge.createLarkSession(),
  }
}
