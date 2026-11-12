import './index.scss'

interface OutlineItemProps {
  title: string
  detail: string
  selected: boolean
  invalid?: boolean
  controls: string
  onSelect: () => void
}

export default function OutlineItem({
  title,
  detail,
  selected,
  invalid = false,
  controls,
  onSelect,
}: OutlineItemProps) {
  return (
    <button
      type="button"
      className="outline-item"
      aria-current={selected || undefined}
      aria-controls={controls}
      data-selected={selected}
      data-invalid={invalid}
      onClick={onSelect}
    >
      <span className="outline-item-title">{title}</span>
      <span className="outline-item-detail">{detail}</span>
    </button>
  )
}
