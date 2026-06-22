export interface WalAsarPatchBase {
  styleOverridesBySelector: Record<string, Record<string, string>>
  colorOverrides: Record<string, string>
  enableDevTools: boolean
  customScript?: string
  description?: string
}

export interface WalAsarPatchMainScript extends WalAsarPatchBase {
  kind: 'main-script'
  subject: string
}

export interface WalAsarPatchFile extends WalAsarPatchBase {
  kind: 'file'
  path: string
}

export type WalAsarPatch = WalAsarPatchMainScript | WalAsarPatchFile

export interface WalTheme {
  /** 主题唯一标识。导入时同 id 直接覆盖；缺省时回退用源文件名。 */
  id?: string
  /** 显示名称。 */
  name?: string
  /** 描述。 */
  description?: string
  /** 作者。 */
  author?: string
  asarPatches: Record<string, WalAsarPatch[]>
}

/** 主题库中的一条记录（持久化在 themes.json 的清单里）。 */
export interface ThemeEntry {
  /** 唯一标识：主题 YAML 的 id，缺省时回退源文件名。 */
  id: string
  /** 托管目录中的文件名（由 id 派生）。 */
  fileName: string
  /** 是否启用——启用的主题会在「应用」时合并生效。 */
  enabled: boolean
}

/** themes.json 的结构。数组顺序即优先级，顶部最高（冲突时覆盖下面的）。 */
export interface ThemeManifest {
  themes: ThemeEntry[]
}
