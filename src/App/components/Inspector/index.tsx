import { useEffect, useState } from 'react'

import { Dot, Tab, TabList, TabPanel, Tabs } from '@a1knla/cakeui'

import ActivityLog from './components/ActivityLog'
import ThemeDetail from './components/ThemeDetail'

import { isFailureLog, useLogsStore } from '../../../store/logs'
import { LibraryItem } from '../../../store/theme-library'
import { InspectorTab } from '../../vm'

import './index.scss'

interface InspectorProps {
  className?: string
  tab: InspectorTab
  onTabChange: (tab: InspectorTab) => void
  detailId: string
  item: LibraryItem | null
  loaded: boolean
  disabled: boolean
  first: boolean
  last: boolean
  onMove: (offset: number) => void
  onRemove: () => void
  onReimport: () => void
}

export default function Inspector({
  className,
  tab,
  onTabChange,
  detailId,
  item,
  loaded,
  disabled,
  first,
  last,
  onMove,
  onRemove,
  onReimport,
}: InspectorProps) {
  const logs = useLogsStore((state) => state.logs)
  const [seenCount, setSeenCount] = useState(0)
  useEffect(() => {
    if (tab === 'log' || logs.length < seenCount) setSeenCount(logs.length)
  }, [tab, logs.length, seenCount])
  // 只有未查看过的失败记录才提示，普通进度输出不打扰。
  const unreadFailure = tab !== 'log' && logs.slice(seenCount).some((log) => isFailureLog(log.text))

  return (
    <Tabs
      className={`inspector ${className ?? ''}`}
      value={tab}
      onValueChange={(value) => onTabChange(value as InspectorTab)}
    >
      <TabList className="inspector-tabs" aria-label="主题详情和运行记录">
        <Tab value="detail">详情</Tab>
        <Tab value="log">
          运行记录
          {unreadFailure && <Dot tone="danger" aria-label="有新的失败记录" />}
        </Tab>
      </TabList>
      <TabPanel value="detail" className="inspector-panel">
        <ThemeDetail
          id={detailId}
          item={item}
          loaded={loaded}
          disabled={disabled}
          first={first}
          last={last}
          onMove={onMove}
          onRemove={onRemove}
          onReimport={onReimport}
        />
      </TabPanel>
      <TabPanel value="log" className="inspector-panel">
        <ActivityLog />
      </TabPanel>
    </Tabs>
  )
}
