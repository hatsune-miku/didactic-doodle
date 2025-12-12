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
  asarPatches: Record<string, WalAsarPatch[]>
}
