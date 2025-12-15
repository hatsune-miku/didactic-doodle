import { Tab, Tabs } from '@heroui/react'
import ThemeLoaderPage from './pages/ThemeLoaderPage'
import LarkToolsPage from './pages/LarkToolsPage'
import WalSettingsPage from './pages/WalSettingsPage'
import LogsView from './components/LogsView'
import './App.scss'
import ToolBar from './components/ToolBar'

function App() {
  return (
    <main className="min-h-screen app-shell text-slate-800 px-4 pb-4 pt-1 max-h-1 overflow-hidden flex flex-row items-stretch gap-4">
      <div className="flex flex-col gap-1 w-full grow">
        <Tabs className="main-tabs grow-0 shrink-0" destroyInactiveTabPanel={false}>
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
      </div>
      <div className="flex flex-col gap-1 grow shrink w-[600px] w-min-[600px] w-max-[600px]">
        <ToolBar />
        <LogsView />
      </div>
    </main>
  )
}

export default App
