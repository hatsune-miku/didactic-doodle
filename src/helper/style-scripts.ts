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

  const defaultSheet = window.document.styleSheets[0]
  if (defaultSheet) {
    Object.entries(styleOverridesBySelector).forEach(([selector, style]) => {
      const rule = \`\${selector} { \${Object.entries(style)
        .map(([key, value]) => \`\${key}: \${value};\`)
        .join(' ')} }\`
      defaultSheet.insertRule(rule)
    })
  }

  if (enableDevTools) {
    const el = document.createElement('script')
    el.src = 'https://cdn.jsdelivr.net/npm/eruda'
    el.onerror = (e) => {
      alert('failed to load eruda: ' + JSON.stringify(e))
    }
    const el2 = document.createElement('script')
    el2.innerHTML = 'eruda.init(); eruda.show()'
    document.body.appendChild(el)
    setTimeout(() => {
      document.body.appendChild(el2)
    }, 1000)
  }

  // WAL CUSTOM SCRIPT START
  ${customScript}
  // WAL CUSTOM SCRIPT END
}

start()`
}
