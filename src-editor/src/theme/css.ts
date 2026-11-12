export type StyleMap = Record<string, Record<string, string>>

const OUTSIDE_RULE = '声明需要写在选择器后的 { } 内'

function lineAt(text: string, index: number): number {
  return text.slice(0, index).split('\n').length
}

function syntaxError(text: string, index: number, message: string): Error {
  return new Error(`第 ${lineAt(text, index)} 行：${message}`)
}

/** 注释替换为等长空白，保留换行，使报错行号与原文一致。 */
function blankComments(text: string): string {
  let result = ''
  let index = 0
  while (index < text.length) {
    const start = text.indexOf('/*', index)
    if (start === -1) return result + text.slice(index)
    const end = text.indexOf('*/', start + 2)
    if (end === -1) throw syntaxError(text, start, '注释缺少结尾的 */')
    result += text.slice(index, start) + text.slice(start, end + 2).replace(/[^\n]/g, ' ')
    index = end + 2
  }
  return result
}

function collapse(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

/**
 * 把一段只含普通规则的 CSS 解析为「选择器 → 属性 → 值」。
 * 引号与括号内的分号、花括号按原样保留；同一选择器或属性重复时与 CSS 一样后者覆盖前者。
 */
export function parseStyles(source: string): StyleMap {
  const text = blankComments(source)
  const styles: StyleMap = {}
  let selector: string | null = null
  let chunkStart = 0
  let blockStart = 0
  let quote: string | null = null
  let quoteStart = 0
  let depth = 0

  function addDeclaration(end: number) {
    const chunk = text.slice(chunkStart, end)
    if (!chunk.trim() || selector === null) return
    const offset = chunkStart + chunk.search(/\S/)
    const colon = chunk.indexOf(':')
    if (colon === -1) throw syntaxError(text, offset, `“${collapse(chunk)}”缺少冒号`)
    const property = collapse(chunk.slice(0, colon))
    const value = collapse(chunk.slice(colon + 1))
    if (!property) throw syntaxError(text, offset, '冒号前缺少属性名')
    if (!value) throw syntaxError(text, offset, `${property} 缺少值`)
    if (property === '__proto__') throw syntaxError(text, offset, '不能使用 __proto__ 作为属性名')
    const declarations = styles[selector]
    delete declarations[property]
    declarations[property] = value
  }

  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (quote) {
      if (char === '\\') index++
      else if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      quoteStart = index
    } else if (char === '(' || char === '[') depth++
    else if ((char === ')' || char === ']') && depth > 0) depth--
    else if (depth > 0) continue
    else if (selector === null) {
      if (char === '{') {
        const name = collapse(text.slice(chunkStart, index))
        if (!name) throw syntaxError(text, index, '{ 前缺少选择器')
        if (name.startsWith('@')) throw syntaxError(text, chunkStart, '不支持 @media 等 @ 规则')
        // 选择器里的伪类紧跟名称，冒号后有空白或出现分号时多半是漏写了规则的声明。
        if (name.includes(';') || /:\s/.test(name)) throw syntaxError(text, chunkStart, OUTSIDE_RULE)
        if (name === '__proto__') throw syntaxError(text, chunkStart, '不能使用 __proto__ 作为选择器')
        selector = name
        if (!Object.hasOwn(styles, selector)) styles[selector] = {}
        blockStart = index
        chunkStart = index + 1
      } else if (char === '}') throw syntaxError(text, index, '多余的 }')
    } else if (char === '{') throw syntaxError(text, index, '不支持嵌套规则')
    else if (char === ';' || char === '}') {
      addDeclaration(index)
      chunkStart = index + 1
      if (char === '}') selector = null
    }
  }

  if (quote) throw syntaxError(text, quoteStart, '引号没有闭合')
  if (selector !== null) throw syntaxError(text, blockStart, `${selector} 缺少结尾的 }`)
  const rest = text.slice(chunkStart)
  if (rest.trim()) {
    const offset = chunkStart + rest.search(/\S/)
    throw syntaxError(text, offset, rest.includes(':') ? OUTSIDE_RULE : `“${collapse(rest)}”后缺少 { }`)
  }
  return styles
}

/** 规范化输出，空规则保留为 `选择器 {}` 以便继续编辑。 */
export function formatStyles(styles: StyleMap): string {
  return Object.entries(styles)
    .map(([selector, declarations]) => {
      const lines = Object.entries(declarations).map(([property, value]) => `  ${property}: ${value};\n`)
      return lines.length ? `${selector} {\n${lines.join('')}}` : `${selector} {}`
    })
    .join('\n\n')
}
