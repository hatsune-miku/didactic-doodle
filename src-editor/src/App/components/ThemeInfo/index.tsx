import { useId } from 'react'

import { Button, Field, TextArea, TextBox } from '@a1knla/cakeui'

import { WalTheme } from '../../../theme/types'
import { MetaField } from '../../vm'

import './index.scss'

interface ThemeInfoProps {
  theme: WalTheme
  onChange: (field: MetaField, value: string) => void
  onCommit: () => void
  onAddPatch: () => void
}

export default function ThemeInfo({ theme, onChange, onCommit, onAddPatch }: ThemeInfoProps) {
  const id = useId()
  const empty = Object.keys(theme.asarPatches).length === 0
  return (
    <div className="theme-info">
      <Field label="名称" htmlFor={`${id}-name`} className="theme-info-wide">
        <TextBox
          id={`${id}-name`}
          value={theme.name ?? ''}
          placeholder="未命名主题"
          onChange={(event) => onChange('name', event.currentTarget.value)}
          onBlur={onCommit}
        />
      </Field>
      <Field label="标识" htmlFor={`${id}-id`} description="导入时替换标识相同的主题；留空则使用文件名。">
        <TextBox
          id={`${id}-id`}
          className="theme-info-mono"
          value={theme.id ?? ''}
          spellCheck={false}
          autoCapitalize="off"
          aria-describedby={`${id}-id-help`}
          onChange={(event) => onChange('id', event.currentTarget.value)}
          onBlur={onCommit}
        />
      </Field>
      <Field label="作者" htmlFor={`${id}-author`}>
        <TextBox
          id={`${id}-author`}
          value={theme.author ?? ''}
          onChange={(event) => onChange('author', event.currentTarget.value)}
          onBlur={onCommit}
        />
      </Field>
      <Field label="描述" htmlFor={`${id}-description`} className="theme-info-wide">
        <TextArea
          id={`${id}-description`}
          rows={3}
          value={theme.description ?? ''}
          onChange={(event) => onChange('description', event.currentTarget.value)}
          onBlur={onCommit}
        />
      </Field>
      {empty && (
        <div className="theme-info-empty theme-info-wide">
          <p className="theme-info-empty-text">
            还没有补丁。补丁指定要修改飞书的哪个文件，以及要注入的样式、颜色变量和脚本。
          </p>
          <Button onClick={onAddPatch}>添加补丁</Button>
        </div>
      )}
    </div>
  )
}
