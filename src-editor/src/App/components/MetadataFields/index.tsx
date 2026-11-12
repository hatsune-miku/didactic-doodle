import { useId } from 'react'

import { Field, TextArea, TextBox } from '@a1knla/cakeui'

import { WalTheme } from '../../../theme/types'

import './index.scss'

export default function MetadataFields({
  theme,
  onChange,
}: {
  theme: WalTheme
  onChange: (field: 'id' | 'name' | 'author' | 'description', value: string) => void
}) {
  const id = useId()
  return (
    <div className="metadata-fields">
      <Field label="主题名称" htmlFor={`${id}-name`}>
        <TextBox
          id={`${id}-name`}
          value={theme.name || ''}
          onChange={(event) => onChange('name', event.currentTarget.value)}
        />
      </Field>
      <Field label="标识" htmlFor={`${id}-id`}>
        <TextBox
          id={`${id}-id`}
          value={theme.id || ''}
          onChange={(event) => onChange('id', event.currentTarget.value)}
        />
      </Field>
      <Field label="作者" htmlFor={`${id}-author`}>
        <TextBox
          id={`${id}-author`}
          value={theme.author || ''}
          onChange={(event) => onChange('author', event.currentTarget.value)}
        />
      </Field>
      <Field label="描述" htmlFor={`${id}-description`} className="metadata-description">
        <TextArea
          id={`${id}-description`}
          rows={2}
          value={theme.description || ''}
          onChange={(event) => onChange('description', event.currentTarget.value)}
        />
      </Field>
    </div>
  )
}
