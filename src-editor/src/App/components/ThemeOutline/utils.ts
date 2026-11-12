import { WalAsarPatch, WalTheme } from '../../../theme/types'

export const KIND_LABEL: Record<WalAsarPatch['kind'], string> = { 'main-script': '主脚本', file: '文件' }

export function patchTarget(patch: WalAsarPatch): string {
  return patch.kind === 'main-script' ? patch.subject : patch.path
}

export function patchSummary(patch: WalAsarPatch): string {
  if (patch.description) return patch.description
  const rules = Object.keys(patch.styleOverridesBySelector).length
  const colors = Object.keys(patch.colorOverrides).length
  const parts = [
    rules && `${rules} 条样式规则`,
    colors && `${colors} 个颜色变量`,
    patch.customScript?.trim() && '脚本',
    patch.enableDevTools && '开发者工具',
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : '空补丁'
}

export function themeSummary(theme: WalTheme): string {
  const parts = [theme.id, theme.author].filter(Boolean)
  return parts.length ? parts.join(' · ') : '主题信息'
}
