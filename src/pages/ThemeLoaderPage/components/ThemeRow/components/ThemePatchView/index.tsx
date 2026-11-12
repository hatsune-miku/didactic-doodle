import { Accordion, AccordionItem } from '@a1knla/cakeui'

import ColorPreview from './components/ColorPreview'

import { WalTheme } from '../../../../../../theme/types'

import './index.scss'

export default function ThemePatchView({ theme }: { theme: WalTheme }) {
  return (
    <div className="theme-patch-view wal-copyable">
      {Object.keys(theme.asarPatches).length === 0 && <p className="theme-patch-empty">此主题没有补丁。</p>}
      <Accordion>
        {Object.entries(theme.asarPatches).map(([path, patches]) => (
          <AccordionItem key={path} title={<span className="theme-patch-path">{path}</span>}>
            {patches.map((patch, index) => (
              <section key={index} className="theme-patch-content">
                <p className="theme-patch-target">
                  {patch.kind === 'main-script' ? `主脚本 ${patch.subject}` : patch.path}
                </p>
                {patch.description && <p className="theme-patch-description">{patch.description}</p>}
                {Object.entries(patch.styleOverridesBySelector || {}).map(([selector, declarations]) => (
                  <div key={selector} className="theme-patch-style">
                    <code className="theme-patch-selector">{selector}</code>
                    {Object.entries(declarations).map(([property, value]) => (
                      <div key={property} className="theme-patch-value">
                        <code className="theme-patch-property">{property}:</code>
                        <ColorPreview value={value} />
                      </div>
                    ))}
                  </div>
                ))}
                {Object.entries(patch.colorOverrides || {}).map(([key, value]) => (
                  <div key={key} className="theme-patch-value">
                    <code className="theme-patch-property">{key}:</code>
                    <ColorPreview value={value} />
                  </div>
                ))}
                {patch.enableDevTools && <p className="theme-patch-description">启用开发者工具</p>}
                {patch.customScript && <pre className="theme-patch-code">{patch.customScript}</pre>}
              </section>
            ))}
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
