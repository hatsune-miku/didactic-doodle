import { useRef } from 'react'

import { Alert, Button, Dialog } from '@a1knla/cakeui'

import { ExitIntent } from '../../vm'

import './index.scss'

interface ExitLarkDialogProps {
  intent: ExitIntent | null
  busy: boolean
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}

const copy: Record<ExitIntent, { title: string; description: string; confirm: string }> = {
  exit: {
    title: '退出飞书？',
    description: '飞书中未保存的内容可能丢失。',
    confirm: '退出飞书',
  },
  apply: {
    title: '退出飞书并应用主题？',
    description: '应用主题前需要退出飞书，飞书中未保存的内容可能丢失。',
    confirm: '退出并应用',
  },
  restore: {
    title: '退出飞书并恢复原版？',
    description: '恢复原版前需要退出飞书，飞书中未保存的内容可能丢失。',
    confirm: '退出并恢复',
  },
}

export default function ExitLarkDialog({ intent, busy, error, onCancel, onConfirm }: ExitLarkDialogProps) {
  const cancelButton = useRef<HTMLButtonElement>(null)
  // 关闭过渡期间保留最后一次的文案，避免对话框消失前文字跳变。
  const lastIntent = useRef<ExitIntent>('exit')
  if (intent) lastIntent.current = intent
  const text = copy[intent ?? lastIntent.current]

  return (
    <Dialog
      open={intent !== null}
      onOpenChange={(open) => !open && onCancel()}
      title={text.title}
      description={text.description}
      closeLabel="关闭"
      initialFocus={cancelButton}
      className="exit-lark-dialog"
      footer={
        <>
          <Button ref={cancelButton} onClick={onCancel} disabled={busy}>
            取消
          </Button>
          <Button variant="danger" loading={busy} onClick={onConfirm}>
            {error ? '重试' : text.confirm}
          </Button>
        </>
      }
    >
      {error && (
        <Alert tone="danger" className="exit-lark-dialog-error">
          <span className="wal-copyable">{error}</span>
        </Alert>
      )}
    </Dialog>
  )
}
