import { useId, useRef, useState } from 'react'

import { Button, Dialog, Field, TextBox } from '@a1knla/cakeui'

import { EntryRequest } from '../../types'

import './index.scss'

export default function EntryDialog({ request, onClose }: { request: EntryRequest; onClose: () => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const id = useId()
  const formId = `${id}-form`
  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!value.trim()) {
      setError(`请输入${request.label}。`)
      return
    }
    try {
      request.onSubmit(value.trim())
      onClose()
    } catch (error) {
      setError(String(error))
    }
  }
  return (
    <Dialog
      open
      title={request.title}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      closeLabel="关闭"
      initialFocus={input}
      className="entry-dialog"
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" type="submit" form={formId}>
            添加
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit}>
        <Field label={request.label} htmlFor={id} error={error}>
          <TextBox
            ref={input}
            id={id}
            value={value}
            placeholder={request.placeholder}
            onChange={(event) => {
              setValue(event.currentTarget.value)
              setError(null)
            }}
            aria-describedby={error ? `${id}-help` : undefined}
            aria-invalid={!!error}
          />
        </Field>
      </form>
    </Dialog>
  )
}
