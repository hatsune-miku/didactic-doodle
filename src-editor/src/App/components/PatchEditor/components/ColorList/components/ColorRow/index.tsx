import { useEffect, useRef, useState } from 'react'

import { Button, TextBox } from '@a1knla/cakeui'

import { isColor, toHex } from './utils'

import './index.scss'

interface ColorRowProps {
  id: string
  name: string
  value: string
  autoFocus: boolean
  isTaken: (name: string) => boolean
  onRename: (name: string) => void
  onValue: (value: string) => void
  onCommit: () => void
  onRemove: () => void
}

export default function ColorRow({
  id,
  name,
  value,
  autoFocus,
  isTaken,
  onRename,
  onValue,
  onCommit,
  onRemove,
}: ColorRowProps) {
  const [draft, setDraft] = useState(name)
  const [error, setError] = useState<string | null>(null)
  const nameInput = useRef<HTMLInputElement>(null)
  const valueInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(name)
    setError(null)
  }, [name])

  useEffect(() => {
    if (!autoFocus) return
    nameInput.current?.focus()
    nameInput.current?.select()
  }, [autoFocus])

  function commitName(): boolean {
    const next = draft.trim()
    if (!next) return fail('请填写变量名。')
    if (next !== name && isTaken(next)) return fail(`${next} 已存在。`)
    setError(null)
    setDraft(next)
    if (next !== name) onRename(next)
    return true
  }

  function fail(message: string): false {
    setError(`${message}变量名尚未修改。`)
    return false
  }

  const hex = toHex(value)
  return (
    <div className="color-row" data-invalid={Boolean(error)}>
      <TextBox
        ref={nameInput}
        id={`${id}-name`}
        className="color-row-name"
        value={draft}
        placeholder="--变量名"
        spellCheck={false}
        autoCapitalize="off"
        aria-label="变量名"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => {
          setDraft(event.currentTarget.value)
          setError(null)
        }}
        onBlur={commitName}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            if (commitName()) valueInput.current?.focus()
          } else if (event.key === 'Escape' && draft !== name) {
            event.preventDefault()
            setDraft(name)
            setError(null)
          }
        }}
      />
      <TextBox
        ref={valueInput}
        className="color-row-value"
        value={value}
        placeholder="#e8788a"
        spellCheck={false}
        autoCapitalize="off"
        aria-label={`${name} 的值`}
        onChange={(event) => onValue(event.currentTarget.value)}
        onBlur={onCommit}
      />
      <span className="color-row-swatch" data-empty={!isColor(value)}>
        <span className="color-row-swatch-fill" style={isColor(value) ? { background: value } : undefined} />
        <input
          type="color"
          className="color-row-picker"
          value={hex ?? '#000000'}
          aria-label={`为 ${name} 选择颜色`}
          onChange={(event) => onValue(event.currentTarget.value)}
          onBlur={onCommit}
        />
      </span>
      <Button variant="ghost" className="color-row-remove" aria-label={`移除 ${name}`} onClick={onRemove}>
        <CloseIcon />
      </Button>
      {error && (
        <p className="color-row-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="m4 4 8 8M12 4l-8 8" />
    </svg>
  )
}
