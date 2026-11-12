import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useThemeLibraryStore } from './theme-library'

import { nativeBridge } from '../ports/bridge'

const content = 'id: example\nname: 示例\nasarPatches: {}\n'
const initialItems = [
  { entry: { id: 'one', fileName: 'one.yaml', enabled: true }, theme: { asarPatches: {} }, parseError: false },
  { entry: { id: 'two', fileName: 'two.yaml', enabled: false }, theme: { asarPatches: {} }, parseError: false },
]

describe('theme library persistence', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useThemeLibraryStore.setState({ items: initialItems, loaded: true })
    vi.spyOn(nativeBridge, 'writeThemeManifest').mockResolvedValue(undefined)
    vi.spyOn(nativeBridge, 'deleteTheme').mockResolvedValue(undefined)
    vi.spyOn(nativeBridge, 'readTheme').mockResolvedValue(content)
  })
  it('retains the previous selection when saving fails and permits a retry', async () => {
    vi.mocked(nativeBridge.writeThemeManifest).mockRejectedValueOnce(new Error('disk full'))
    await expect(useThemeLibraryStore.getState().toggleEnabled('one')).rejects.toThrow('disk full')
    expect(useThemeLibraryStore.getState().items[0].entry.enabled).toBe(true)
    await useThemeLibraryStore.getState().toggleEnabled('one')
    expect(useThemeLibraryStore.getState().items[0].entry.enabled).toBe(false)
  })
  it('keeps the previous order on a failed save and rejects duplicate identifiers', async () => {
    vi.mocked(nativeBridge.writeThemeManifest).mockRejectedValueOnce(new Error('disk full'))
    await expect(useThemeLibraryStore.getState().reorder(['two', 'one'])).rejects.toThrow('disk full')
    expect(useThemeLibraryStore.getState().items).toEqual(initialItems)
    await useThemeLibraryStore.getState().reorder(['one', 'one'])
    expect(nativeBridge.writeThemeManifest).toHaveBeenCalledOnce()
    await useThemeLibraryStore.getState().reorder(['two', 'one'])
    expect(useThemeLibraryStore.getState().items.map((item) => item.entry.id)).toEqual(['two', 'one'])
  })
  it('does not delete a theme file when updating the manifest fails', async () => {
    vi.mocked(nativeBridge.writeThemeManifest).mockRejectedValueOnce(new Error('read-only manifest'))
    await expect(useThemeLibraryStore.getState().removeTheme('one')).rejects.toThrow('read-only manifest')
    expect(nativeBridge.deleteTheme).not.toHaveBeenCalled()
    expect(useThemeLibraryStore.getState().items).toEqual(initialItems)
  })
  it('refuses to silently omit an enabled theme that cannot be read', async () => {
    vi.mocked(nativeBridge.readTheme).mockRejectedValueOnce(new Error('file missing'))
    await expect(useThemeLibraryStore.getState().collectEnabledThemes()).rejects.toThrow('file missing')
  })
  it('keeps a damaged manifest as a recoverable failure instead of an empty library', async () => {
    vi.spyOn(nativeBridge, 'readThemeManifest').mockResolvedValue('{ damaged')
    await expect(useThemeLibraryStore.getState().load()).rejects.toThrow()
    expect(useThemeLibraryStore.getState().items).toEqual(initialItems)
  })
  it('keeps a broken theme visible with its specific read error', async () => {
    vi.spyOn(nativeBridge, 'readThemeManifest').mockResolvedValue(JSON.stringify({ themes: [initialItems[0].entry] }))
    vi.mocked(nativeBridge.readTheme).mockRejectedValueOnce(new Error('access denied'))
    await useThemeLibraryStore.getState().load()
    expect(useThemeLibraryStore.getState().items[0]).toMatchObject({
      parseError: true,
      error: expect.stringContaining('access denied'),
    })
  })
})
