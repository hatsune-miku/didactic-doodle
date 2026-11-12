import { WalAsarPatchBase } from '../theme/types'

export function makeStylesScript(patch: WalAsarPatchBase) {
  const { styleOverridesBySelector = {}, colorOverrides = {}, enableDevTools = false, customScript = '' } = patch

  return `function start() {
  const enableDevTools = ${enableDevTools}
  const colorOverrides = ${JSON.stringify(colorOverrides)}
  Object.entries(colorOverrides).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value)
  })

  const styleOverridesBySelector = ${JSON.stringify(styleOverridesBySelector)}

  const styleElement = document.createElement('style')
  styleElement.dataset.walTheme = 'true'
  styleElement.textContent = Object.entries(styleOverridesBySelector).map(([selector, style]) => {
      return \`\${selector} { \${Object.entries(style)
        .map(([key, value]) => \`\${key}: \${value};\`)
        .join(' ')} }\`
  }).join('\\n')
  document.head.appendChild(styleElement)

  if (enableDevTools) {
    const el = document.createElement('script')
    el.src = 'https://cdn.jsdelivr.net/npm/eruda'
    el.onerror = (e) => {
      alert('failed to load eruda: ' + JSON.stringify(e))
    }
    el.onload = () => { window.eruda.init(); window.eruda.show() }
    document.body.appendChild(el)
  }

  // WAL CUSTOM SCRIPT START
  ${customScript}
  // WAL CUSTOM SCRIPT END
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true })
} else {
  start()
}`
}
