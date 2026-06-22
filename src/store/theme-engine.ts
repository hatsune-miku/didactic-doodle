import { create } from 'zustand'

export type WorkingState = 'idle' | 'working' | 'done' | 'error'

export interface ThemeEngineStore {
  workingState: WorkingState
  currentProgress: number
  maxProgress: number
  setWorkingState: (state: WorkingState) => void
  setCurrentProgress: (progress: number) => void
  setMaxProgress: (max: number) => void
  incrementCurrentProgress: () => void
}

export const useThemeEngineStore = create<ThemeEngineStore>((set) => ({
  workingState: 'idle',
  currentProgress: 0,
  maxProgress: 0,
  setWorkingState: (state: WorkingState) => set({ workingState: state }),
  setCurrentProgress: (progress: number) => set({ currentProgress: progress }),
  setMaxProgress: (max: number) => set({ maxProgress: max }),
  incrementCurrentProgress: () => set((state) => ({ currentProgress: state.currentProgress + 1 })),
}))
