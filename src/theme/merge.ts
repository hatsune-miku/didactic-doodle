import { WalAsarPatch, WalAsarPatchBase, WalTheme } from './types'

/**
 * 每个补丁的目标标识：用于判断两个补丁是否落在同一个内部文件上。
 * 这正好对应 Rust 端「每个内部文件只保留一个 WAL 代码块」的约束——
 * 同 targetKey 的补丁必须合并，否则后者会整块覆盖前者。
 */
function targetKey(patch: WalAsarPatch): string {
  return patch.kind === 'file' ? `file::${patch.path}` : `main-script::${patch.subject}`
}

function mergeStyles(
  lower: Record<string, Record<string, string>> = {},
  higher: Record<string, Record<string, string>> = {}
): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {}
  for (const [selector, decls] of Object.entries(lower)) {
    out[selector] = { ...decls }
  }
  for (const [selector, decls] of Object.entries(higher)) {
    out[selector] = { ...(out[selector] ?? {}), ...decls }
  }
  return out
}

function concatScript(lower?: string, higher?: string): string {
  // 低优先级在前、高优先级在后，保证高优先级脚本最后执行、可覆盖前者
  return [lower, higher]
    .map((s) => (s ?? '').trim())
    .filter((s) => s.length > 0)
    .join('\n')
}

/** 把同一目标文件上的两个补丁合并，higher 的冲突项胜出。 */
function mergePatch(lower: WalAsarPatch, higher: WalAsarPatch): WalAsarPatch {
  const base: WalAsarPatchBase = {
    styleOverridesBySelector: mergeStyles(lower.styleOverridesBySelector, higher.styleOverridesBySelector),
    colorOverrides: { ...(lower.colorOverrides ?? {}), ...(higher.colorOverrides ?? {}) },
    enableDevTools: Boolean(lower.enableDevTools) || Boolean(higher.enableDevTools),
    customScript: concatScript(lower.customScript, higher.customScript),
    description: higher.description || lower.description,
  }
  // 同 targetKey 意味着 kind 与 path/subject 必定一致，沿用 higher 的即可
  if (higher.kind === 'main-script') {
    return { ...base, kind: 'main-script', subject: higher.subject }
  }
  return { ...base, kind: 'file', path: higher.path }
}

/** 把一个补丁规范化为不与源对象共享引用的副本（字段补全为空默认值）。 */
function clonePatch(patch: WalAsarPatch): WalAsarPatch {
  const base: WalAsarPatchBase = {
    styleOverridesBySelector: mergeStyles(patch.styleOverridesBySelector, {}),
    colorOverrides: { ...(patch.colorOverrides ?? {}) },
    enableDevTools: Boolean(patch.enableDevTools),
    customScript: (patch.customScript ?? '').trim(),
    description: patch.description,
  }
  if (patch.kind === 'main-script') {
    return { ...base, kind: 'main-script', subject: patch.subject }
  }
  return { ...base, kind: 'file', path: patch.path }
}

/**
 * 把多个启用的主题合并成一个可直接应用的 WalTheme。
 *
 * @param themes 按优先级排序，index 0 为最高优先级（冲突时覆盖后面的）。
 *
 * 合并规则：按 asar 分组，组内按 targetKey 分桶；同桶内逐键深合并样式/颜色、
 * 按低→高拼接脚本、enableDevTools 取或。结果中每个内部文件恰好一个补丁，无丢失。
 */
export function mergeThemes(themes: WalTheme[]): WalTheme {
  // 从低优先级处理到高优先级，使高优先级覆盖低优先级
  const lowToHigh = [...themes].reverse()
  const byAsar = new Map<string, Map<string, WalAsarPatch>>()

  for (const theme of lowToHigh) {
    if (!theme || !theme.asarPatches) {
      continue
    }
    for (const [asar, patches] of Object.entries(theme.asarPatches)) {
      if (!patches || patches.length === 0) {
        continue
      }
      let bucket = byAsar.get(asar)
      if (!bucket) {
        bucket = new Map()
        byAsar.set(asar, bucket)
      }
      for (const patch of patches) {
        const key = targetKey(patch)
        const existing = bucket.get(key)
        bucket.set(key, existing ? mergePatch(existing, patch) : clonePatch(patch))
      }
    }
  }

  const asarPatches: Record<string, WalAsarPatch[]> = {}
  for (const [asar, bucket] of byAsar.entries()) {
    asarPatches[asar] = [...bucket.values()]
  }
  return { asarPatches }
}
