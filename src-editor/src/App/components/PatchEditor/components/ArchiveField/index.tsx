import { useEffect, useState } from 'react'

import { Field, TextBox } from '@a1knla/cakeui'

import './index.scss'

interface ArchiveFieldProps {
  id: string
  value: string
  suggestions: string[]
  onCommit: (path: string) => void
}

/** ASAR 路径是补丁分组的键，只在失焦或回车时提交，避免每次按键都把补丁搬到新分组。 */
export default function ArchiveField({ id, value, suggestions, onCommit }: ArchiveFieldProps) {
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setDraft(value)
    setError(null)
  }, [value])

  function commit() {
    const path = draft.trim().replace(/\\/g, '/')
    if (!path) return setError('请填写 ASAR 包路径。')
    if (!path.toLowerCase().endsWith('.asar')) return setError('路径应以 .asar 结尾。')
    setError(null)
    setDraft(path)
    if (path !== value) onCommit(path)
  }

  return (
    <Field
      label="ASAR 包"
      htmlFor={id}
      className="archive-field"
      description="相对飞书安装目录，例如 webcontent/messenger.asar。"
      error={error && `${error}修改尚未生效。`}
    >
      <TextBox
        id={id}
        className="archive-field-input"
        value={draft}
        list={`${id}-list`}
        spellCheck={false}
        autoCapitalize="off"
        aria-describedby={`${id}-help`}
        aria-invalid={Boolean(error)}
        onChange={(event) => {
          setDraft(event.currentTarget.value)
          setError(null)
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit()
          } else if (event.key === 'Escape' && draft !== value) {
            event.preventDefault()
            setDraft(value)
            setError(null)
          }
        }}
      />
      <datalist id={`${id}-list`}>
        {suggestions.map((path) => (
          <option key={path} value={path} />
        ))}
      </datalist>
    </Field>
  )
}
