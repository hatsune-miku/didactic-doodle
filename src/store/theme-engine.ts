import { create } from 'zustand'
import { WalTheme } from '../theme/types'

export type WorkingState = 'idle' | 'working' | 'done' | 'error'

export interface PatchState {
  hasBackup: boolean
}

export interface ThemeEngineStore {
  workingState: WorkingState
  activeTheme: WalTheme | null
  patchStateMap: Record<string, PatchState>
  currentProgress: number
  maxProgress: number
  setActiveTheme: (theme: WalTheme) => void
  setWorkingState: (state: WorkingState) => void
  setCurrentProgress: (progress: number) => void
  setMaxProgress: (max: number) => void
  incrementCurrentProgress: () => void
  setPatchStateMap: (map: Record<string, PatchState>) => void
}

export const useThemeEngineStore = create<ThemeEngineStore>((set) => ({
  workingState: 'idle',
  activeTheme: null,
  patchStateMap: {},
  currentProgress: 0,
  maxProgress: 0,
  setActiveTheme: (theme: WalTheme) => set({ activeTheme: theme }),
  setWorkingState: (state: WorkingState) => set({ workingState: state }),
  setCurrentProgress: (progress: number) => set({ currentProgress: progress }),
  setMaxProgress: (max: number) => set({ maxProgress: max }),
  incrementCurrentProgress: () => set((state) => ({ currentProgress: state.currentProgress + 1 })),
  setPatchStateMap: (map: Record<string, PatchState>) => set({ patchStateMap: map }),
}))
