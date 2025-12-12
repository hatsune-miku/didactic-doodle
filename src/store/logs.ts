import { create } from 'zustand'

export interface Log {
  text: string
  timestamp: number
}

export interface LogsStore {
  logs: Log[]
  add: (text: string) => void
  clear: () => void
}

export const useLogsStore = create<LogsStore>((set) => ({
  logs: [],
  add: (text: string) => {
    const components = text.split(' ')
    if (isAllCapitalized(components[0])) {
      // Remove log level
      components.shift()
    }
    const logText = components.join(' ')

    const log: Log = {
      timestamp: Date.now(),
      text: logText,
    }
    set((state) => ({ logs: [...state.logs, log] }))
  },
  clear: () => set({ logs: [] }),
}))

function isAllCapitalized(text: string): boolean {
  return Boolean(text) && text.toUpperCase() === text && /^[A-Z]+$/.test(text)
}
