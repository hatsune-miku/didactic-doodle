import { create } from 'zustand'
import { nativeBridge } from '../ports/bridge'
import { ThemeEntry, ThemeManifest, WalTheme } from '../theme/types'
import { parseTheme } from '../theme'
import { useLogsStore } from './logs'

/** 库中的一条主题：清单条目 + 用于展示/预览的已解析内容（应用时一律重新读盘）。 */
export interface LibraryItem {
  entry: ThemeEntry
  theme: WalTheme | null
  parseError: boolean
}

interface ThemeLibraryStore {
  items: LibraryItem[]
  loaded: boolean
  /** 从清单加载主题库，并读取各文件用于展示。 */
  load: () => Promise<void>
  /** 弹框选择一个主题文件，校验通过后按 id 入库（同 id 覆盖，保留启用状态与位置）。 */
  importTheme: () => Promise<void>
  removeTheme: (id: string) => Promise<void>
  toggleEnabled: (id: string) => Promise<void>
  /** 按给定 id 顺序重排（顶部优先级最高）。 */
  reorder: (orderedIds: string[]) => Promise<void>
  /** 按优先级（顶部最高）从磁盘新鲜读取所有启用项，跳过非法文件。 */
  collectEnabledThemes: () => Promise<WalTheme[]>
}

function log(message: string) {
  useLogsStore.getState().add(message)
}

/** 主题的展示名：优先 YAML 的 name，回退到 id。 */
export function themeDisplayName(item: LibraryItem): string {
  return item.theme?.name?.trim() || item.entry.id
}

async function persist(items: LibraryItem[]) {
  const manifest: ThemeManifest = { themes: items.map((item) => item.entry) }
  await nativeBridge.writeThemeManifest(JSON.stringify(manifest, null, 2))
}

export const useThemeLibraryStore = create<ThemeLibraryStore>((set, get) => ({
  items: [],
  loaded: false,

  async load() {
    let manifest: ThemeManifest = { themes: [] }
    try {
      manifest = JSON.parse(await nativeBridge.readThemeManifest()) as ThemeManifest
    } catch (error) {
      log(`读取主题清单失败: ${String(error)}`)
    }

    const entries = Array.isArray(manifest.themes) ? manifest.themes : []
    const items = await Promise.all(
      entries.map(async (entry): Promise<LibraryItem> => {
        try {
          const content = await nativeBridge.readTheme(entry.fileName)
          const theme = parseTheme(content)
          return { entry, theme, parseError: theme === null }
        } catch {
          log(`主题文件丢失或无法读取: ${entry.fileName}`)
          return { entry, theme: null, parseError: true }
        }
      })
    )

    set({ items, loaded: true })
  },

  async importTheme() {
    const picked = await nativeBridge.pickThemeFile()
    if (!picked) {
      // 用户取消
      return
    }

    const theme = parseTheme(picked.content)
    if (!theme) {
      log('导入失败：无法解析该 YAML')
      return
    }

    // 以 YAML 的 id 作为唯一标识，缺省时回退源文件名
    const id = theme.id?.trim() || picked.suggestedId
    const fileName = await nativeBridge.saveTheme(id, picked.content)

    const items = get().items
    const index = items.findIndex((item) => item.entry.id === id)
    let nextItems: LibraryItem[]
    if (index >= 0) {
      // 同 id 覆盖：保留原有启用状态与列表位置，只更新文件名与内容
      const entry: ThemeEntry = { ...items[index].entry, fileName }
      nextItems = items.map((item, i) => (i === index ? { entry, theme, parseError: false } : item))
      log(`已更新主题: ${theme.name?.trim() || id}`)
    } else {
      const entry: ThemeEntry = { id, fileName, enabled: true }
      nextItems = [...items, { entry, theme, parseError: false }]
      log(`已导入主题: ${theme.name?.trim() || id}`)
    }

    set({ items: nextItems })
    await persist(nextItems)
  },

  async removeTheme(id) {
    const target = get().items.find((item) => item.entry.id === id)
    if (!target) {
      return
    }
    await nativeBridge.deleteTheme(target.entry.fileName).catch(() => {})
    const items = get().items.filter((item) => item.entry.id !== id)
    set({ items })
    await persist(items)
  },

  async toggleEnabled(id) {
    const items = get().items.map((item) =>
      item.entry.id === id ? { ...item, entry: { ...item.entry, enabled: !item.entry.enabled } } : item
    )
    set({ items })
    await persist(items)
  },

  async reorder(orderedIds) {
    const items = get().items
    const byId = new Map(items.map((item) => [item.entry.id, item]))
    const next = orderedIds.map((id) => byId.get(id)).filter((item): item is LibraryItem => Boolean(item))
    // 防御：数量对不上时不动，避免丢条目
    if (next.length !== items.length) {
      return
    }
    set({ items: next })
    await persist(next)
  },

  async collectEnabledThemes() {
    const enabled = get().items.filter((item) => item.entry.enabled)
    const themes: WalTheme[] = []
    for (const item of enabled) {
      try {
        const content = await nativeBridge.readTheme(item.entry.fileName)
        const theme = parseTheme(content)
        if (theme) {
          themes.push(theme)
        } else {
          log(`跳过无法解析的主题: ${themeDisplayName(item)}`)
        }
      } catch {
        log(`跳过无法读取的主题: ${themeDisplayName(item)}`)
      }
    }
    return themes
  },
}))
