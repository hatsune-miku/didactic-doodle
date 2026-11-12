import { create } from 'zustand'

import { useLogsStore } from './logs'

import { nativeBridge } from '../ports/bridge'
import { decodeTheme } from '../theme'
import { ThemeEntry, ThemeManifest, WalTheme } from '../theme/types'

/** 库中的一条主题：清单条目 + 用于展示/预览的已解析内容（应用时一律重新读盘）。 */
export interface LibraryItem {
  entry: ThemeEntry
  theme: WalTheme | null
  parseError: boolean
  error?: string
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
  /** 按优先级（顶部最高）从磁盘新鲜读取所有启用项；任何读取或解析失败都停止应用。 */
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
    const manifest = JSON.parse(await nativeBridge.readThemeManifest()) as ThemeManifest
    if (
      !Array.isArray(manifest.themes) ||
      !manifest.themes.every(
        (entry) =>
          entry !== null &&
          typeof entry === 'object' &&
          typeof entry.id === 'string' &&
          typeof entry.fileName === 'string' &&
          typeof entry.enabled === 'boolean'
      )
    ) {
      throw new Error('主题清单格式错误：需要包含 id、fileName 和 enabled 的 themes 列表。')
    }
    const entries = manifest.themes
    const items = await Promise.all(
      entries.map(async (entry): Promise<LibraryItem> => {
        try {
          const content = await nativeBridge.readTheme(entry.fileName)
          const theme = decodeTheme(content)
          return { entry, theme, parseError: false }
        } catch (error) {
          const message = `读取 ${entry.fileName} 失败: ${String(error)}`
          log(message)
          return { entry, theme: null, parseError: true, error: message }
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

    const theme = decodeTheme(picked.content)

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
    } else {
      const entry: ThemeEntry = { id, fileName, enabled: true }
      nextItems = [...items, { entry, theme, parseError: false }]
    }

    await persist(nextItems)
    set({ items: nextItems })
    log(`已${index >= 0 ? '更新' : '导入'}主题: ${theme.name?.trim() || id}`)
  },

  async removeTheme(id) {
    const target = get().items.find((item) => item.entry.id === id)
    if (!target) {
      return
    }
    const items = get().items.filter((item) => item.entry.id !== id)
    await persist(items)
    try {
      await nativeBridge.deleteTheme(target.entry.fileName)
    } catch (error) {
      throw new Error(`清理 ${target.entry.fileName} 失败: ${String(error)}`)
    }
    set({ items })
  },

  async toggleEnabled(id) {
    const items = get().items.map((item) =>
      item.entry.id === id ? { ...item, entry: { ...item.entry, enabled: !item.entry.enabled } } : item
    )
    await persist(items)
    set({ items })
  },

  async reorder(orderedIds) {
    const items = get().items
    const byId = new Map(items.map((item) => [item.entry.id, item]))
    const next = orderedIds.map((id) => byId.get(id)).filter((item): item is LibraryItem => Boolean(item))
    // 防御：数量对不上时不动，避免丢条目
    if (next.length !== items.length || new Set(orderedIds).size !== items.length) {
      return
    }
    await persist(next)
    set({ items: next })
  },

  async collectEnabledThemes() {
    const enabled = get().items.filter((item) => item.entry.enabled)
    const themes: WalTheme[] = []
    for (const item of enabled) {
      try {
        const content = await nativeBridge.readTheme(item.entry.fileName)
        themes.push(decodeTheme(content))
      } catch (error) {
        throw new Error(`读取启用的主题 ${themeDisplayName(item)} 失败: ${String(error)}`)
      }
    }
    return themes
  },
}))
