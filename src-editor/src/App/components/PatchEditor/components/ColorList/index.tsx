import { useState } from 'react'

import { Button } from '@a1knla/cakeui'

import ColorRow from './components/ColorRow'

import { renameKey } from '../../../../../theme/model'

import './index.scss'

interface ColorListProps {
  id: string
  colors: Record<string, string>
  onChange: (colors: Record<string, string>, field?: string) => void
  onCommit: () => void
}

function nextName(colors: Record<string, string>): string {
  let index = Object.keys(colors).length + 1
  while (Object.hasOwn(colors, `--color-${index}`)) index++
  return `--color-${index}`
}

export default function ColorList({ id, colors, onChange, onCommit }: ColorListProps) {
  const [focusIndex, setFocusIndex] = useState<number | null>(null)
  const entries = Object.entries(colors)

  function handleAdd() {
    onCommit()
    setFocusIndex(entries.length)
    onChange({ ...colors, [nextName(colors)]: '' })
  }

  function handleRemove(name: string, index: number) {
    const next = { ...colors }
    delete next[name]
    onCommit()
    onChange(next)
    // 焦点落到同位置的下一行，没有则回到添加按钮。
    requestAnimationFrame(() => {
      const target =
        document.getElementById(`${id}-${Math.min(index, entries.length - 2)}-name`) ??
        document.getElementById(`${id}-add`)
      target?.focus()
    })
  }

  return (
    <div className="color-list" role="group" aria-labelledby={`${id}-label`} aria-describedby={`${id}-help`}>
      <span className="color-list-label" id={`${id}-label`}>
        颜色变量
      </span>
      <span className="color-list-help" id={`${id}-help`}>
        写到页面根元素上的 CSS 变量，名称以 -- 开头。
      </span>
      {entries.length > 0 && (
        <div className="color-list-rows">
          {entries.map(([name, value], index) => (
            <ColorRow
              key={index}
              id={`${id}-${index}`}
              name={name}
              value={value}
              autoFocus={focusIndex === index}
              isTaken={(candidate) => Object.hasOwn(colors, candidate)}
              onRename={(next) => {
                onCommit()
                onChange(renameKey(colors, name, next))
              }}
              onValue={(next) => onChange({ ...colors, [name]: next }, `color:${name}`)}
              onCommit={onCommit}
              onRemove={() => handleRemove(name, index)}
            />
          ))}
        </div>
      )}
      <Button variant="ghost" size="small" id={`${id}-add`} className="color-list-add" onClick={handleAdd}>
        添加颜色变量
      </Button>
    </div>
  )
}
