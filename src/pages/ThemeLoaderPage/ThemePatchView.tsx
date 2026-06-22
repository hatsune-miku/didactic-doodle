import React from 'react'
import { WalTheme } from '../../theme/types'
import { isColorLike } from './utils'

/** 只读地展示一个主题包含的所有 asar 补丁（样式 / 颜色 / 自定义脚本）。 */
export function ThemePatchView({ theme }: { theme: WalTheme }) {
  const asarFiles = Object.keys(theme.asarPatches)
  if (asarFiles.length === 0) {
    return <span className="text-xs text-gray-500">此主题不包含任何补丁</span>
  }

  return (
    <div className="theme-patch-view">
      {asarFiles.map((asarFile) => {
        const patchList = theme.asarPatches[asarFile] || []
        return (
          <div key={asarFile} className="theme-patch-asar">
            <div className="theme-patch-asar-name">{asarFile}</div>
            {patchList.map((patch, index) => {
              const styleSelectors = Object.keys(patch.styleOverridesBySelector || {})
              const colorKeys = Object.keys(patch.colorOverrides || {})
              return (
                <div key={index} className="theme-loader-patch-content">
                  <span className="font-medium">
                    补丁 #{index + 1} · {patch.kind === 'main-script' ? '主脚本' : '文件'}
                    {patch.description ? ` · ${patch.description}` : ''}
                  </span>

                  {styleSelectors.length > 0 ? <div className="font-medium">样式 ({styleSelectors.length})</div> : null}
                  {styleSelectors.map((selector) => {
                    const entries = Object.entries(patch.styleOverridesBySelector[selector])
                    return (
                      <div key={selector} className="mt-1">
                        <div className="font-mono text-[11px]" style={{ color: '#8b6f7e' }}>
                          {selector}
                        </div>
                        <div className="text-[11px] break-all" style={{ color: '#8b6f7e', opacity: 0.8 }}>
                          {entries.map(([prop, value]) => (
                            <div key={prop} className="flex items-start gap-1">
                              <span className="font-mono shrink-0">{prop}:</span>
                              <ColorPreview value={value} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}

                  {colorKeys.length > 0 ? <div className="font-medium">颜色 ({colorKeys.length})</div> : null}
                  {colorKeys.map((key) => (
                    <div key={key} className="text-[11px]" style={{ color: '#8b6f7e', opacity: 0.8 }}>
                      <span className="font-mono">{key}</span>
                      <span className="mx-1">→</span>
                      <ColorPreview value={patch.colorOverrides[key]} />
                    </div>
                  ))}

                  {patch.customScript ? (
                    <React.Fragment>
                      <div className="font-medium">自定义脚本</div>
                      <div className="theme-loader-code-block">{patch.customScript}</div>
                    </React.Fragment>
                  ) : null}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function ColorPreview({ value }: { value: string }) {
  if (!isColorLike(value)) {
    return <span>{value}</span>
  }
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block w-3 h-3 rounded border"
        style={{ backgroundColor: value, borderColor: 'rgba(255, 182, 193, 0.3)' }}
      />
      <span>{value}</span>
    </span>
  )
}
