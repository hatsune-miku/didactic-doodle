import { isColorLike } from './utils'

import './index.scss'

export default function ColorValue({ value }: { value: string }) {
  return (
    <span className="color-value">
      {isColorLike(value) && (
        <span className="color-value-swatch" style={{ backgroundColor: value }} aria-hidden="true" />
      )}
      <code className="color-value-text">{value}</code>
    </span>
  )
}
