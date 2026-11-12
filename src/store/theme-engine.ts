import { create } from 'zustand'

export type WorkingState = 'idle' | 'working' | 'done' | 'error'
export type ThemeOperation = 'apply' | 'restore'

export interface ThemeEngineStore {
  workingState: WorkingState
  currentProgress: number
  maxProgress: number
  permissionAction: ThemeOperation | null
  lastOperation: ThemeOperation
  lastError: string | null
  completionMessage: string | null
  setCompletionMessage: (message: string | null) => void
  setLastError: (error: string | null) => void
  setLastOperation: (action: ThemeOperation) => void
  setPermissionAction: (action: ThemeOperation | null) => void
  setWorkingState: (state: WorkingState) => void
  setCurrentProgress: (progress: number) => void
  setMaxProgress: (max: number) => void
  incrementCurrentProgress: () => void
}

export const useThemeEngineStore = create<ThemeEngineStore>((set) => ({
  workingState: 'idle',
  currentProgress: 0,
  maxProgress: 0,
  permissionAction: null,
  lastOperation: 'apply',
  lastError: null,
  completionMessage: null,
  setCompletionMessage: (completionMessage) => set({ completionMessage }),
  setLastError: (lastError) => set({ lastError }),
  setLastOperation: (lastOperation) => set({ lastOperation }),
  setPermissionAction: (permissionAction) => set({ permissionAction }),
  setWorkingState: (state: WorkingState) => set({ workingState: state }),
  setCurrentProgress: (progress: number) => set({ currentProgress: progress }),
  setMaxProgress: (max: number) => set({ maxProgress: max }),
  incrementCurrentProgress: () => set((state) => ({ currentProgress: state.currentProgress + 1 })),
}))
