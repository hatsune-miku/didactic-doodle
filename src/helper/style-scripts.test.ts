import { describe, expect, it, vi } from 'vitest'

import { makeStylesScript } from './style-scripts'

function documentFixture(readyState: string) {
  const document = {
    readyState,
    documentElement: { style: { setProperty: vi.fn() } },
    head: { appendChild: vi.fn() },
    body: { appendChild: vi.fn() },
    createElement: vi.fn(() => ({ dataset: {}, textContent: '' })),
    addEventListener: vi.fn(),
  }
  return document
}

function script(enableDevTools = false) {
  return makeStylesScript({
    styleOverridesBySelector: { '.message': { color: 'red' } },
    colorOverrides: { '--primary': 'blue' },
    enableDevTools,
    customScript: 'window.themeApplied = true',
  })
}

describe('theme script lifecycle', () => {
  it('waits for the DOM when injected into an early runtime script', () => {
    const document = documentFixture('loading')
    const window: Record<string, unknown> = {}
    new Function('document', 'window', script())(document, window)
    expect(document.head.appendChild).not.toHaveBeenCalled()
    expect(window.themeApplied).toBeUndefined()
    expect(document.addEventListener).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function), { once: true })
    document.addEventListener.mock.calls[0][1]()
    expect(document.documentElement.style.setProperty).toHaveBeenCalledWith('--primary', 'blue')
    expect(document.head.appendChild).toHaveBeenCalledWith(
      expect.objectContaining({
        textContent: '.message { color: red; }',
      })
    )
    expect(window.themeApplied).toBe(true)
  })

  it('applies styles without relying on the host page having a stylesheet', () => {
    const document = documentFixture('complete')
    new Function('document', 'window', script())(document, {})
    expect(document.head.appendChild).toHaveBeenCalledOnce()
    expect(document.addEventListener).not.toHaveBeenCalled()
  })

  it('initializes devtools only after its script has loaded', () => {
    const document = documentFixture('interactive')
    const window = { eruda: { init: vi.fn(), show: vi.fn() } }
    new Function('document', 'window', script(true))(document, window)
    expect(window.eruda.init).not.toHaveBeenCalled()
    document.body.appendChild.mock.calls[0][0].onload()
    expect(window.eruda.init).toHaveBeenCalledOnce()
    expect(window.eruda.show).toHaveBeenCalledOnce()
  })
})
