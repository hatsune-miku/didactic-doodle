import { Button, LogView } from '@a1knla/cakeui'

import { useLogsStore } from '../../store/logs'

import './index.scss'

const timeFormat = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

export default function LogsView() {
  const { logs, clear } = useLogsStore()
  return (
    <section className="logs-view" aria-label="运行记录">
      <LogView className="logs-view-content" aria-label="运行记录">
        {logs.length === 0 ? (
          <p className="logs-view-empty">暂无运行记录</p>
        ) : (
          logs.map((log, index) => (
            <div className="logs-entry" key={`${log.timestamp}-${index}`}>
              <time
                className="logs-entry-time"
                dateTime={new Date(log.timestamp).toISOString()}
                title={new Date(log.timestamp).toLocaleString()}
              >
                {timeFormat.format(log.timestamp)}
              </time>
              <span className="logs-entry-text">{log.text}</span>
            </div>
          ))
        )}
      </LogView>
      <div className="logs-view-actions">
        <Button variant="ghost" size="small" disabled={logs.length === 0} onClick={clear}>
          清空记录
        </Button>
      </div>
    </section>
  )
}
