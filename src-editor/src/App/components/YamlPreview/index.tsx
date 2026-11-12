import { useState } from 'react'

import { Alert, Button, TextArea } from '@a1knla/cakeui'

import './index.scss'

export default function YamlPreview({ content }: { content: string }) {
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    setError(null)
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
    } catch (error) {
      setError(`复制失败: ${String(error)}`)
    }
  }
  return (
    <section className="yaml-preview" aria-label="YAML 预览">
      <div className="yaml-preview-toolbar">
        <span>YAML</span>
        <Button size="small" variant="ghost" onClick={handleCopy} onBlur={() => setCopied(false)}>
          {copied ? '已复制' : '复制'}
        </Button>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <TextArea aria-label="主题 YAML" value={content} readOnly className="yaml-preview-code" spellCheck={false} />
    </section>
  )
}
