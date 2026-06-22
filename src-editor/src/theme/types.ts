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
