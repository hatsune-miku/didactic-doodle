import { Button, LogView } from '@a1knla/cakeui'

import { isFailureLog, useLogsStore } from '../../../../../store/logs'

import './index.scss'

const timeFormat = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

export default function ActivityLog() {
  const { logs, clear } = useLogsStore()
  return (
    <div className="activity-log">
      <LogView className="activity-log-view" aria-label="运行记录">
        {logs.length === 0 ? (
          <p className="activity-log-empty">暂无记录</p>
        ) : (
          logs.map((log, index) => {
            const time = timeFormat.format(log.timestamp)
            // 相邻且同一秒的记录省略时间，便于成组阅读一次操作的输出。
            const repeated = index > 0 && timeFormat.format(logs[index - 1].timestamp) === time
            return (
              <div
                className="activity-log-entry"
                key={`${log.timestamp}-${index}`}
                data-tone={isFailureLog(log.text) ? 'danger' : undefined}
              >
                <time
                  className="activity-log-time"
                  dateTime={new Date(log.timestamp).toISOString()}
                  title={new Date(log.timestamp).toLocaleString()}
                >
                  {repeated ? '' : time}
                </time>
                <span className="activity-log-text">{log.text}</span>
              </div>
            )
          })
        )}
      </LogView>
      <div className="activity-log-footer">
        <span className="activity-log-count">{logs.length > 0 ? `${logs.length} 条记录` : ''}</span>
        <Button variant="ghost" size="small" disabled={logs.length === 0} onClick={clear}>
          清空
        </Button>
      </div>
    </div>
  )
}
