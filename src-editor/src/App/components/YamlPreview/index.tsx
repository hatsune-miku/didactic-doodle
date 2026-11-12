import { useEffect, useState } from 'react'

import { Alert, Button } from '@a1knla/cakeui'

import { errorMessage } from '../../vm'

import './index.scss'

export default function YamlPreview({ className, content }: { className?: string; content: string }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lines = content.trimEnd().split('\n').length

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  async function handleCopy() {
    setError(null)
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
    } catch (error) {
      setError(`复制失败：${errorMessage(error)}`)
    }
  }

  return (
    <section className={`yaml-preview ${className ?? ''}`} aria-label="YAML 预览">
      <div className="yaml-preview-bar">
        <span className="yaml-preview-meta">YAML · {lines} 行</span>
        <Button size="small" variant="ghost" onClick={handleCopy}>
          {copied ? '已复制' : '复制'}
        </Button>
      </div>
      {error && (
        <Alert tone="danger" className="yaml-preview-alert">
          <span className="wal-copyable">{error}</span>
          <Button size="small" onClick={handleCopy}>
            重试
          </Button>
        </Alert>
      )}
      <pre className="yaml-preview-code wal-copyable" tabIndex={0} aria-label="主题 YAML">
        {content}
      </pre>
    </section>
  )
}
