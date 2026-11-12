import { isColorLike } from '../../../../../../utils'

import './index.scss'

export default function ColorPreview({ value }: { value: string }) {
  return (
    <span className="color-preview">
      {isColorLike(value) && (
        <span className="color-preview-swatch" style={{ backgroundColor: value }} aria-hidden="true" />
      )}
      <span>{value}</span>
    </span>
  )
}
