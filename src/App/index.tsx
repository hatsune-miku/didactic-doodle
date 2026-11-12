import { CakeProvider } from '@a1knla/cakeui'

import ActionBar from './components/ActionBar'
import AppManagementPermission from './components/AppManagementPermission'
import ExitLarkDialog from './components/ExitLarkDialog'
import Inspector from './components/Inspector'
import LibraryBar from './components/LibraryBar'
import ThemeList from './components/ThemeList'
import { useWorkspace } from './vm'

import './index.scss'

const DETAIL_ID = 'wal-theme-detail'

export default function App() {
  const vm = useWorkspace()
  return (
    <CakeProvider accentColor="#e8788a" foreground="light" mode="system" density="compact" className="wal-app">
      <main className="workspace">
        <LibraryBar
          className="workspace-library"
          disabled={vm.disabled}
          loaded={vm.loaded}
          onImport={vm.handleImport}
          onOpenEditor={vm.handleOpenEditor}
        />
        <ThemeList
          className="workspace-themes"
          items={vm.items}
          loaded={vm.loaded}
          busy={vm.libraryBusy}
          error={vm.libraryError}
          disabled={vm.disabled}
          selectedId={vm.selected?.entry.id ?? null}
          detailId={DETAIL_ID}
          onSelect={vm.handleSelect}
          onToggle={vm.handleToggle}
          onMove={vm.handleMove}
          onReorder={vm.handleReorder}
          onImport={vm.handleImport}
          onRetry={vm.handleRetryLibrary}
          onDismissError={vm.handleDismissLibraryError}
        />
        <ActionBar
          className="workspace-actions"
          engine={vm.engine}
          lark={vm.lark}
          loaded={vm.loaded}
          disabled={vm.disabled}
          libraryBusy={vm.libraryBusy}
          enabledCount={vm.enabledCount}
          onApply={vm.handleApply}
          onRestore={vm.handleRestore}
          onRetry={vm.handleRetryOperation}
          onDismiss={vm.handleDismissStatus}
          onShowLog={() => vm.setInspectorTab('log')}
          onLaunch={vm.handleLaunch}
          onExit={vm.handleRequestExit}
          onDismissLaunchError={vm.handleDismissLaunchError}
        />
        <Inspector
          className="workspace-inspector"
          tab={vm.inspectorTab}
          onTabChange={vm.setInspectorTab}
          detailId={DETAIL_ID}
          item={vm.selected}
          loaded={vm.loaded}
          disabled={vm.disabled}
          first={vm.selectedIndex === 0}
          last={vm.selectedIndex === vm.items.length - 1}
          onMove={(offset) => vm.selected && vm.handleMove(vm.selected.entry.id, offset)}
          onRemove={() => vm.selected && vm.handleRemove(vm.selected.entry.id)}
          onReimport={vm.handleImport}
        />
      </main>
      <ExitLarkDialog
        intent={vm.lark.exitIntent}
        busy={vm.lark.exiting}
        error={vm.lark.exitError}
        onCancel={vm.handleCancelExit}
        onConfirm={vm.handleConfirmExit}
      />
      <AppManagementPermission />
    </CakeProvider>
  )
}
