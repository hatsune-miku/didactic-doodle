import { Fragment } from 'react'

import { Tag } from '@a1knla/cakeui'

import ColorValue from './components/ColorValue'

import { WalAsarPatch } from '../../../../../../../../../theme/types'

import './index.scss'

export default function PatchItem({ patch }: { patch: WalAsarPatch }) {
  const styles = Object.entries(patch.styleOverridesBySelector || {})
  const colors = Object.entries(patch.colorOverrides || {})
  return (
    <div className="patch-item">
      <p className="patch-item-target">
        <span className="patch-item-kind">{patch.kind === 'main-script' ? '主脚本' : '文件'}</span>
        <span className="patch-item-subject">{patch.kind === 'main-script' ? patch.subject : patch.path}</span>
        {patch.enableDevTools && <Tag tone="warning">开发者工具</Tag>}
      </p>
      {patch.description && <p className="patch-item-description">{patch.description}</p>}
      {(styles.length > 0 || colors.length > 0) && (
        <div className="patch-item-rules">
          {styles.map(([selector, declarations]) => (
            <Fragment key={selector}>
              <code className="patch-item-selector">{selector}</code>
              {Object.entries(declarations).map(([property, value]) => (
                <Fragment key={property}>
                  <code className="patch-item-property">{property}</code>
                  <ColorValue value={value} />
                </Fragment>
              ))}
            </Fragment>
          ))}
          {colors.length > 0 && <span className="patch-item-selector patch-item-group-label">颜色变量</span>}
          {colors.map(([key, value]) => (
            <Fragment key={key}>
              <code className="patch-item-property">{key}</code>
              <ColorValue value={value} />
            </Fragment>
          ))}
        </div>
      )}
      {patch.customScript && <pre className="patch-item-script">{patch.customScript}</pre>}
    </div>
  )
}
