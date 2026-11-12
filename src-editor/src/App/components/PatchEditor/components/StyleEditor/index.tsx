import { useEffect, useRef, useState } from 'react'

import { Field, TextArea } from '@a1knla/cakeui'

import { StyleMap, formatStyles, parseStyles } from '../../../../../theme/css'
import { errorMessage } from '../../../../vm'

import './index.scss'

/** 停止输入这么久后才提示语法错误，避免边写边报错。 */
const ERROR_DELAY = 700
const PLACEHOLDER = '.message-bubble {\n  background-color: #fde7ec;\n}'

interface StyleEditorProps {
  id: string
  value: StyleMap
  onChange: (styles: StyleMap) => void
  onCommit: () => void
}

/**
 * 以 CSS 文本编辑「选择器 → 属性 → 值」。文本合法时立即写入主题；
 * 不合法时保留草稿并提示原因，外部改动（撤销、导入）会替换草稿。
 */
export default function StyleEditor({ id, value, onChange, onCommit }: StyleEditorProps) {
  const [draft, setDraft] = useState(() => formatStyles(value))
  const [error, setError] = useState<string | null>(null)
  const [showError, setShowError] = useState(false)
  const committed = useRef(draft)

  useEffect(() => {
    const formatted = formatStyles(value)
    if (formatted === committed.current) return
    committed.current = formatted
    setDraft(formatted)
    setError(null)
  }, [value])

  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => setShowError(true), ERROR_DELAY)
    return () => clearTimeout(timer)
  }, [draft, error])

  function handleChange(text: string) {
    setDraft(text)
    setShowError(false)
    try {
      const styles = parseStyles(text)
      setError(null)
      const formatted = formatStyles(styles)
      if (formatted === committed.current) return
      committed.current = formatted
      onChange(styles)
    } catch (error) {
      setError(errorMessage(error))
    }
  }

  function handleBlur() {
    onCommit()
    if (error) setShowError(true)
    // 合法时整理成规范格式，让文本与保存的内容一致。
    else setDraft(committed.current)
  }

  const lines = draft.split('\n').length
  return (
    <Field
      label="样式"
      htmlFor={id}
      className="style-editor"
      description="按 CSS 写选择器和声明。不支持 @media 等嵌套规则，注释不会保存。"
      error={showError && error ? `${error}。修改尚未保存。` : null}
    >
      <TextArea
        id={id}
        className="style-editor-input"
        rows={Math.min(24, Math.max(6, lines + 1))}
        value={draft}
        placeholder={PLACEHOLDER}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        aria-describedby={`${id}-help`}
        aria-invalid={showError && Boolean(error)}
        onChange={(event) => handleChange(event.currentTarget.value)}
        onBlur={handleBlur}
      />
    </Field>
  )
}
