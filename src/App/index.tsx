import { CakeProvider } from '@a1knla/cakeui'

import AppManagementPermission from '../components/AppManagementPermission'
import LogsView from '../components/LogsView'
import ToolBar from '../components/ToolBar'
import ThemeLoaderPage from '../pages/ThemeLoaderPage'

import './index.scss'

export default function App() {
  return (
    <CakeProvider accentColor="#e8788a" foreground="light" mode="system" density="compact" className="wal-app">
      <main className="app-shell">
        <ThemeLoaderPage />
        <aside className="app-activity" aria-label="飞书状态和运行记录">
          <ToolBar />
          <LogsView />
        </aside>
      </main>
      <AppManagementPermission />
    </CakeProvider>
  )
}
