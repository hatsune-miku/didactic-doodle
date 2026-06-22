import { describe, expect, it } from 'vitest'
import { mergeThemes } from './merge'
import { WalAsarPatchFile, WalAsarPatchMainScript, WalTheme } from './types'

function fileTheme(asar: string, patch: Partial<WalAsarPatchFile> & { path: string }): WalTheme {
  return {
    asarPatches: {
      [asar]: [
        {
          kind: 'file',
          styleOverridesBySelector: {},
          colorOverrides: {},
          enableDevTools: false,
          customScript: '',
          ...patch,
        },
      ],
    },
  }
}

describe('mergeThemes', () => {
  it('returns an empty theme when given no themes', () => {
    expect(mergeThemes([])).toEqual({ asarPatches: {} })
  })

  it('merges two patches on the same file: union styles, higher priority wins color conflicts', () => {
    const high = fileTheme('a.asar', {
      path: 'index.js',
      styleOverridesBySelector: { '.a': { color: 'red' } },
      colorOverrides: { '--bg': 'black', '--fg': 'white' },
    })
    const low = fileTheme('a.asar', {
      path: 'index.js',
      styleOverridesBySelector: { '.b': { color: 'blue' } },
      colorOverrides: { '--bg': 'green' },
    })

    const merged = mergeThemes([high, low]) // index 0 = highest priority
    const patches = merged.asarPatches['a.asar']
    expect(patches).toHaveLength(1)

    const p = patches[0] as WalAsarPatchFile
    expect(p.styleOverridesBySelector).toEqual({ '.a': { color: 'red' }, '.b': { color: 'blue' } })
    // --bg conflict: high wins; --fg only on high
    expect(p.colorOverrides).toEqual({ '--bg': 'black', '--fg': 'white' })
  })

  it('keeps patches on different files within the same asar as separate entries', () => {
    const t1 = fileTheme('a.asar', { path: 'one.js', colorOverrides: { '--x': '1' } })
    const t2 = fileTheme('a.asar', { path: 'two.js', colorOverrides: { '--y': '2' } })

    const merged = mergeThemes([t1, t2])
    expect(merged.asarPatches['a.asar']).toHaveLength(2)
  })

  it('keeps patches across different asars', () => {
    const t1 = fileTheme('a.asar', { path: 'index.js' })
    const t2 = fileTheme('b.asar', { path: 'index.js' })

    const merged = mergeThemes([t1, t2])
    expect(Object.keys(merged.asarPatches).sort()).toEqual(['a.asar', 'b.asar'])
  })

  it('concatenates custom scripts low-priority-first so the highest priority runs last', () => {
    const high = fileTheme('a.asar', { path: 'index.js', customScript: 'HIGH' })
    const low = fileTheme('a.asar', { path: 'index.js', customScript: 'LOW' })

    const merged = mergeThemes([high, low])
    const p = merged.asarPatches['a.asar'][0]
    expect(p.customScript).toBe('LOW\nHIGH')
  })

  it('ORs enableDevTools across merged patches', () => {
    const off = fileTheme('a.asar', { path: 'index.js', enableDevTools: false })
    const on = fileTheme('a.asar', { path: 'index.js', enableDevTools: true })

    const merged = mergeThemes([off, on])
    expect(merged.asarPatches['a.asar'][0].enableDevTools).toBe(true)
  })

  it('treats main-script patches with the same subject as the same target', () => {
    const mk = (color: string): WalTheme => ({
      asarPatches: {
        'a.asar': [
          {
            kind: 'main-script',
            subject: 'main',
            styleOverridesBySelector: {},
            colorOverrides: { '--c': color },
            enableDevTools: false,
            customScript: '',
          } as WalAsarPatchMainScript,
        ],
      },
    })

    const merged = mergeThemes([mk('red'), mk('blue')])
    const patches = merged.asarPatches['a.asar']
    expect(patches).toHaveLength(1)
    expect((patches[0] as WalAsarPatchMainScript).subject).toBe('main')
    expect(patches[0].colorOverrides).toEqual({ '--c': 'red' }) // index 0 wins
  })

  it('does not mutate the input themes', () => {
    const t = fileTheme('a.asar', { path: 'index.js', colorOverrides: { '--x': '1' } })
    const snapshot = JSON.parse(JSON.stringify(t))
    mergeThemes([t, fileTheme('a.asar', { path: 'index.js', colorOverrides: { '--x': '2' } })])
    expect(t).toEqual(snapshot)
  })
})
