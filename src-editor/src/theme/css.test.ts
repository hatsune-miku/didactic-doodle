import { describe, expect, it } from 'vitest'

import { formatStyles, parseStyles } from './css'

describe('style text', () => {
  it('round-trips selectors, empty rules and values with separators', () => {
    const styles = {
      '.message, .bubble:hover': { color: '#5a2a35', background: 'url("data:image/svg+xml;utf8,<svg/>")' },
      '[data-title="a{b}"]': { 'font-weight': '600 !important' },
      '.empty': {},
    }
    expect(parseStyles(formatStyles(styles))).toEqual(styles)
    expect(formatStyles(styles)).toContain('.empty {}')
    expect(parseStyles('')).toEqual({})
  })
  it('accepts compact CSS with comments and merges repeated rules like CSS', () => {
    const text = '/* 消息 */ .a{color:red;margin : 0 }\n.a { color: blue }\n.b,\n.c { padding: 2px\n  4px }'
    expect(parseStyles(text)).toEqual({ '.a': { margin: '0', color: 'blue' }, '.b, .c': { padding: '2px 4px' } })
  })
  it('reports the line of each syntax error', () => {
    expect(() => parseStyles('.a {\n  color red;\n}')).toThrow('第 2 行：“color red”缺少冒号')
    expect(() => parseStyles('.a {\n  color: ;\n}')).toThrow('第 2 行：color 缺少值')
    expect(() => parseStyles('.a {\n  color: red;')).toThrow('第 1 行：.a 缺少结尾的 }')
    expect(() => parseStyles('@media (width > 1px) {\n.a { color: red }\n}')).toThrow('不支持 @media')
    expect(() => parseStyles('.a { .b { color: red } }')).toThrow('不支持嵌套规则')
    expect(() => parseStyles('color: red;\n.a {}')).toThrow('声明需要写在选择器后的 { } 内')
    expect(() => parseStyles('.a {}\ncolor: red')).toThrow('第 2 行：声明需要写在选择器后的 { } 内')
    expect(() => parseStyles('.a { content: "x }')).toThrow('引号没有闭合')
    expect(() => parseStyles('/* 未结束')).toThrow('注释缺少结尾的 */')
    expect(() => parseStyles('}')).toThrow('多余的 }')
  })
  it('does not write through the object prototype', () => {
    expect(() => parseStyles('__proto__ { polluted: yes }')).toThrow('__proto__')
    expect(() => parseStyles('.a { __proto__: x }')).toThrow('__proto__')
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})
