import { Tab, Tabs } from '@heroui/react'
import ThemeLoaderPage from './pages/ThemeLoaderPage'
import LarkToolsPage from './pages/LarkToolsPage'
import WalSettingsPage from './pages/WalSettingsPage'

import './App.scss'

function App() {
  return (
    <main className="min-h-screen app-shell text-slate-800 px-4 pb-4 pt-1 max-h-1 overflow-hidden flex flex-col">
      <Tabs aria-label="main tabs" variant="underlined" color="warning" className="w-full main-tabs grow-0 shrink-0">
        <Tab key="main" title="主题加载器" className="overflow-hidden flex">
          <ThemeLoaderPage />
        </Tab>
        <Tab key="lark-tools" title="飞书小工具" className="overflow-hidden flex">
          <LarkToolsPage />
        </Tab>
        <Tab key="settings" title="设置" className="relative overflow-hidden flex">
          <WalSettingsPage />
        </Tab>
      </Tabs>
    </main>
  )
}

export default App
