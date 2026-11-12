import { useId } from 'react'

import { Button, Field, RadioButton, Switch, TextArea, TextBox } from '@a1knla/cakeui'

import ArchiveField from './components/ArchiveField'
import ColorList from './components/ColorList'
import StyleEditor from './components/StyleEditor'

import { createPatch } from '../../../theme/model'
import { WalAsarPatch } from '../../../theme/types'

import './index.scss'

const TARGET = {
  'main-script': {
    label: '页面目录',
    placeholder: 'messenger',
    description: 'ASAR 包内的页面目录，会自动找到其中唯一的入口脚本。',
  },
  file: {
    label: '文件路径',
    placeholder: 'dist/index.js',
    description: 'ASAR 包内要写入脚本的 JS 文件。',
  },
} as const

interface PatchEditorProps {
  path: string
  patch: WalAsarPatch
  archives: string[]
  targetId: string
  onChange: (update: (patch: WalAsarPatch) => WalAsarPatch, field?: string) => void
  onCommit: () => void
  onMoveArchive: (path: string) => void
  onRemove: () => void
}

export default function PatchEditor({
  path,
  patch,
  archives,
  targetId,
  onChange,
  onCommit,
  onMoveArchive,
  onRemove,
}: PatchEditorProps) {
  const id = useId()
  const target = TARGET[patch.kind]

  function setKind(kind: WalAsarPatch['kind']) {
    onCommit()
    onChange((current) => ({
      ...createPatch(kind),
      description: current.description,
      customScript: current.customScript,
      enableDevTools: current.enableDevTools,
      styleOverridesBySelector: current.styleOverridesBySelector,
      colorOverrides: current.colorOverrides,
    }))
  }

  function setTarget(value: string) {
    onChange(
      (current) => (current.kind === 'main-script' ? { ...current, subject: value } : { ...current, path: value }),
      'target'
    )
  }

  return (
    <div className="patch-editor">
      <div className="patch-editor-head">
        <fieldset className="patch-editor-kind">
          <legend className="patch-editor-kind-label">类型</legend>
          <RadioButton
            name={`${id}-kind`}
            value="main-script"
            checked={patch.kind === 'main-script'}
            onChange={() => setKind('main-script')}
          >
            主脚本
          </RadioButton>
          <RadioButton
            name={`${id}-kind`}
            value="file"
            checked={patch.kind === 'file'}
            onChange={() => setKind('file')}
          >
            指定文件
          </RadioButton>
        </fieldset>
        <Button variant="ghost" className="patch-editor-remove" onClick={onRemove}>
          移除补丁
        </Button>
      </div>
      <div className="patch-editor-target">
        <ArchiveField id={`${id}-archive`} value={path} suggestions={archives} onCommit={onMoveArchive} />
        <Field label={target.label} htmlFor={targetId} description={target.description}>
          <TextBox
            id={targetId}
            className="patch-editor-mono"
            value={patch.kind === 'main-script' ? patch.subject : patch.path}
            placeholder={target.placeholder}
            spellCheck={false}
            autoCapitalize="off"
            aria-describedby={`${targetId}-help`}
            onChange={(event) => setTarget(event.currentTarget.value)}
            onBlur={onCommit}
          />
        </Field>
        <Field label="说明" htmlFor={`${id}-description`} className="patch-editor-wide">
          <TextBox
            id={`${id}-description`}
            value={patch.description ?? ''}
            placeholder="在主题详情中显示"
            onChange={(event) => {
              const description = event.currentTarget.value
              onChange((current) => ({ ...current, description }), 'description')
            }}
            onBlur={onCommit}
          />
        </Field>
      </div>
      <StyleEditor
        id={`${id}-styles`}
        value={patch.styleOverridesBySelector}
        onChange={(styles) => onChange((current) => ({ ...current, styleOverridesBySelector: styles }), 'styles')}
        onCommit={onCommit}
      />
      <ColorList
        id={`${id}-colors`}
        colors={patch.colorOverrides}
        onChange={(colors, field) => onChange((current) => ({ ...current, colorOverrides: colors }), field)}
        onCommit={onCommit}
      />
      <Field
        label="自定义脚本"
        htmlFor={`${id}-script`}
        description="页面加载后执行的 JavaScript。多个主题修改同一文件时按优先级依次执行。"
      >
        <TextArea
          id={`${id}-script`}
          className="patch-editor-code"
          rows={Math.min(24, Math.max(5, (patch.customScript ?? '').split('\n').length + 1))}
          value={patch.customScript ?? ''}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          aria-describedby={`${id}-script-help`}
          onChange={(event) => {
            const customScript = event.currentTarget.value
            onChange((current) => ({ ...current, customScript }), 'script')
          }}
          onBlur={onCommit}
        />
      </Field>
      <div className="patch-editor-devtools">
        <Switch
          checked={patch.enableDevTools}
          aria-describedby={`${id}-devtools-help`}
          onChange={(event) => {
            const enableDevTools = event.currentTarget.checked
            onCommit()
            onChange((current) => ({ ...current, enableDevTools }))
          }}
        >
          开发者工具
        </Switch>
        <p className="patch-editor-devtools-help" id={`${id}-devtools-help`}>
          在页面中加载 eruda 调试面板，需要能访问 jsDelivr。仅在调试主题时开启。
        </p>
      </div>
    </div>
  )
}
