import { Tooltip } from '@heroui/react'
import { useLogsStore } from '../../store/logs'
import { DateTime } from 'luxon'
import { useEffect, useMemo, useRef } from 'react'
import classNames from 'classnames'
import './index.scss'

export default function LogsView() {
  const { logs } = useLogsStore()

  const logsContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight
    }
  }, [logs.length])

  const components = useMemo(() => {
    const ret = []
    for (let index = 0; index < logs.length; index++) {
      const log = logs[index]
      const timeDelta = index === 0 ? 0 : log.timestamp - logs[index - 1].timestamp
      const shouldOmitDisplayDatetime = index !== 0 && timeDelta < 3000

      const displayDatetime = shouldOmitDisplayDatetime ? '' : DateTime.fromMillis(log.timestamp).toFormat('HH:mm:ss')
      const item = (
        <Tooltip
          content={DateTime.fromMillis(log.timestamp).toFormat('yyyy/MM/dd HH:mm:ss')}
          closeDelay={0}
          style={{
            pointerEvents: 'none',
          }}
        >
          <div
            key={index}
            className={classNames('logs-item', {
              'no-margin': index === 0 || shouldOmitDisplayDatetime,
            })}
          >
            <div className="logs-time">{displayDatetime}</div>
            <div className="logs-text">{log.text}</div>
          </div>
        </Tooltip>
      )
      ret.push(item)
    }
    return ret
  }, [logs])

  return (
    <div ref={logsContainerRef} className="logs-view">
      {components}
    </div>
  )
}
