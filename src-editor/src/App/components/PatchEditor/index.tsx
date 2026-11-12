import { useId } from 'react'

import { Button, CheckBox, ComboBox, Field, TextArea, TextBox } from '@a1knla/cakeui'

import { createPatch } from '../../../theme/model'
import { WalAsarPatch } from '../../../theme/types'
import { EntryRequest } from '../../types'

import './index.scss'

interface PatchEditorProps {
  patch: WalAsarPatch
  index: number
  onChange: (update: (patch: WalAsarPatch) => WalAsarPatch) => void
  onRemove: () => void
  onRequestEntry: (request: EntryRequest) => void
}

export default function PatchEditor({ patch, index, onChange, onRemove, onRequestEntry }: PatchEditorProps) {
  const id = useId()
  function setText(field: 'description' | 'customScript', value: string) {
    onChange((current) => ({ ...current, [field]: value }))
  }
  function setTarget(value: string) {
    onChange((current) =>
      current.kind === 'main-script' ? { ...current, subject: value } : { ...current, path: value }
    )
  }
  function setKind(kind: WalAsarPatch['kind']) {
    onChange((current) => ({
      ...createPatch(kind),
      description: current.description,
      customScript: current.customScript,
      enableDevTools: current.enableDevTools,
      styleOverridesBySelector: current.styleOverridesBySelector,
      colorOverrides: current.colorOverrides,
    }))
  }
  function setDeclaration(selector: string, property: string, value: string) {
    onChange((current) => ({
      ...current,
      styleOverridesBySelector: {
        ...current.styleOverridesBySelector,
        [selector]: { ...current.styleOverridesBySelector[selector], [property]: value },
      },
    }))
  }
  function removeDeclaration(selector: string, property: string) {
    onChange((current) => {
      const declarations = { ...current.styleOverridesBySelector[selector] }
      delete declarations[property]
      return { ...current, styleOverridesBySelector: { ...current.styleOverridesBySelector, [selector]: declarations } }
    })
  }
  function addSelector() {
    onRequestEntry({
      title: '添加选择器',
      label: 'CSS 选择器',
      placeholder: '.message',
      onSubmit: (selector) => {
        if (Object.hasOwn(patch.styleOverridesBySelector, selector)) throw new Error('这个选择器已存在。')
        onChange((current) => ({
          ...current,
          styleOverridesBySelector: { ...current.styleOverridesBySelector, [selector]: {} },
        }))
      },
    })
  }
  function removeSelector(selector: string) {
    onChange((current) => {
      const styles = { ...current.styleOverridesBySelector }
      delete styles[selector]
      return { ...current, styleOverridesBySelector: styles }
    })
  }
  function addProperty(selector: string) {
    onRequestEntry({
      title: '添加样式属性',
      label: 'CSS 属性',
      placeholder: 'color',
      onSubmit: (property) => {
        if (Object.hasOwn(patch.styleOverridesBySelector[selector], property)) throw new Error('这个属性已存在。')
        setDeclaration(selector, property, '')
      },
    })
  }
  function setColor(key: string, value: string) {
    onChange((current) => ({ ...current, colorOverrides: { ...current.colorOverrides, [key]: value } }))
  }
  function addColor() {
    onRequestEntry({
      title: '添加颜色覆盖',
      label: '颜色标识',
      placeholder: 'primaryText',
      onSubmit: (key) => {
        if (Object.hasOwn(patch.colorOverrides, key)) throw new Error('这个颜色标识已存在。')
        setColor(key, '')
      },
    })
  }
  function removeColor(key: string) {
    onChange((current) => {
      const colors = { ...current.colorOverrides }
      delete colors[key]
      return { ...current, colorOverrides: colors }
    })
  }

  return (
    <section className="patch-editor" aria-label={`补丁 ${index + 1}`}>
      <div className="patch-editor-heading">
        <h3>补丁 {index + 1}</h3>
        <Button size="small" variant="ghost" onClick={onRemove}>
          移除补丁
        </Button>
      </div>
      <div className="patch-editor-fields">
        <Field label="补丁类型" htmlFor={`${id}-kind`}>
          <ComboBox
            id={`${id}-kind`}
            value={patch.kind}
            onChange={(event) => setKind(event.currentTarget.value as WalAsarPatch['kind'])}
          >
            <option value="main-script">主脚本</option>
            <option value="file">指定文件</option>
          </ComboBox>
        </Field>
        <Field label={patch.kind === 'main-script' ? 'Subject' : '文件内部路径'} htmlFor={`${id}-target`}>
          <TextBox
            id={`${id}-target`}
            value={patch.kind === 'main-script' ? patch.subject : patch.path}
            onChange={(event) => setTarget(event.currentTarget.value)}
          />
        </Field>
        <Field label="补丁描述" htmlFor={`${id}-description`} className="patch-editor-wide">
          <TextBox
            id={`${id}-description`}
            value={patch.description || ''}
            onChange={(event) => setText('description', event.currentTarget.value)}
          />
        </Field>
      </div>
      <CheckBox
        checked={patch.enableDevTools}
        onChange={(event) => {
          const enabled = event.currentTarget.checked
          onChange((current) => ({ ...current, enableDevTools: enabled }))
        }}
      >
        启用开发者工具
      </CheckBox>
      <div className="patch-editor-section">
        <div className="patch-editor-heading">
          <h4>样式覆盖</h4>
          <Button size="small" variant="ghost" onClick={addSelector}>
            添加选择器
          </Button>
        </div>
        {Object.entries(patch.styleOverridesBySelector).map(([selector, declarations]) => (
          <div className="patch-editor-selector" key={selector}>
            <div className="patch-editor-heading">
              <code className="patch-editor-key wal-copyable">{selector}</code>
              <Button
                size="small"
                variant="ghost"
                aria-label={`移除选择器 ${selector}`}
                onClick={() => removeSelector(selector)}
              >
                移除
              </Button>
            </div>
            {Object.entries(declarations).map(([property, value]) => (
              <div className="patch-editor-value" key={property}>
                <span className="patch-editor-key wal-copyable">{property}</span>
                <TextBox
                  className="patch-editor-value-input"
                  aria-label={`${selector} 的 ${property}`}
                  value={value}
                  onChange={(event) => setDeclaration(selector, property, event.currentTarget.value)}
                />
                <Button
                  size="small"
                  variant="ghost"
                  className="patch-editor-value-remove"
                  aria-label={`移除属性 ${property}`}
                  onClick={() => removeDeclaration(selector, property)}
                >
                  移除
                </Button>
              </div>
            ))}
            <Button
              size="small"
              variant="ghost"
              className="patch-editor-add-property"
              onClick={() => addProperty(selector)}
            >
              添加属性
            </Button>
          </div>
        ))}
      </div>
      <div className="patch-editor-section">
        <div className="patch-editor-heading">
          <h4>颜色覆盖</h4>
          <Button size="small" variant="ghost" onClick={addColor}>
            添加颜色
          </Button>
        </div>
        {Object.entries(patch.colorOverrides).map(([key, value]) => (
          <div className="patch-editor-value" key={key}>
            <span className="patch-editor-key wal-copyable">{key}</span>
            <TextBox
              className="patch-editor-value-input"
              aria-label={`颜色 ${key}`}
              value={value}
              onChange={(event) => setColor(key, event.currentTarget.value)}
            />
            <span className="patch-editor-swatch" style={{ backgroundColor: value }} aria-hidden="true" />
            <Button
              size="small"
              variant="ghost"
              className="patch-editor-value-remove"
              aria-label={`移除颜色 ${key}`}
              onClick={() => removeColor(key)}
            >
              移除
            </Button>
          </div>
        ))}
      </div>
      <Field label="自定义脚本" htmlFor={`${id}-script`}>
        <TextArea
          id={`${id}-script`}
          className="patch-editor-code"
          rows={4}
          value={patch.customScript || ''}
          spellCheck={false}
          onChange={(event) => setText('customScript', event.currentTarget.value)}
        />
      </Field>
    </section>
  )
}
