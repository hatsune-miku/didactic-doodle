import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'

import {
  addPatch,
  createHistory,
  createPatch,
  createTheme,
  historyReducer,
  movePatch,
  readTheme,
  removePatch,
  updatePatch,
  writeTheme,
} from '../theme/model'
import { WalAsarPatch, WalTheme } from '../theme/types'

const DRAFT_KEY = 'wal-theme-editor:draft'
export const DEFAULT_ARCHIVE = 'webcontent/messenger.asar'

export type Selection = { type: 'theme' } | { type: 'patch'; path: string; index: number }
export type MetaField = 'id' | 'name' | 'author' | 'description'
type FocusRequest = 'target' | 'outline' | null
type PatchSelection = Extract<Selection, { type: 'patch' }>

interface Removal {
  open: boolean
  label: string
  /** 每次移除递增，作为提示的 key，让连续移除重新计时。 */
  serial: number
  after: WalTheme | null
  at: PatchSelection | null
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function patchKey(path: string, index: number): string {
  return `${path}#${index}`
}

interface DraftLoad {
  theme: WalTheme
  /** 草稿存在但读不出来时保留原文，供用户复制。 */
  broken: { text: string; error: string } | null
  storageError: string | null
}

function loadDraft(): DraftLoad {
  let text: string | null
  try {
    text = localStorage.getItem(DRAFT_KEY)
  } catch (error) {
    return { theme: createTheme(), broken: null, storageError: errorMessage(error) }
  }
  if (!text) return { theme: createTheme(), broken: null, storageError: null }
  try {
    return { theme: readTheme(text), broken: null, storageError: null }
  } catch (error) {
    return { theme: createTheme(), broken: { text, error: errorMessage(error) }, storageError: null }
  }
}

function exportName(theme: WalTheme): string {
  return `${(theme.id || theme.name || 'wal-theme').replace(/[^\p{L}\p{N}._-]/gu, '-')}.yaml`
}

/** 移除后选中同组的相邻补丁；组被清空时退到上一组的最后一个，没有则回到主题信息。 */
function selectionAfterRemove(theme: WalTheme, path: string, index: number): Selection {
  const patches = theme.asarPatches[path] ?? []
  if (patches.length > 1) return { type: 'patch', path, index: Math.max(0, index - 1) }
  const paths = Object.keys(theme.asarPatches)
  const previous = paths[paths.indexOf(path) - 1]
  if (previous) return { type: 'patch', path: previous, index: theme.asarPatches[previous].length - 1 }
  const next = paths[paths.indexOf(path) + 1]
  if (next) return { type: 'patch', path: next, index: 0 }
  return { type: 'theme' }
}

export function useEditor() {
  const [initial] = useState(loadDraft)
  const [history, dispatch] = useReducer(historyReducer, initial.theme, createHistory)
  const [selection, setSelection] = useState<Selection>({ type: 'theme' })
  // 编辑区按它重建：切换到别的补丁时递增，补丁换到另一个 ASAR 包时不变，焦点和草稿得以保留。
  const [editorKey, setEditorKey] = useState(0)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [brokenDraft, setBrokenDraft] = useState(initial.broken)
  const [draftSaved, setDraftSaved] = useState(false)
  const [draftError, setDraftError] = useState(initial.storageError)
  const [focusRequest, setFocusRequest] = useState<FocusRequest>(null)
  const [removal, setRemoval] = useState<Removal>({ open: false, label: '', serial: 0, after: null, at: null })
  const [brokenCopy, setBrokenCopy] = useState<string | null>(null)

  const theme = history.present
  const yaml = useMemo(() => writeTheme(theme), [theme])
  const selectedPatch = selection.type === 'patch' ? theme.asarPatches[selection.path]?.[selection.index] : undefined
  // 撤销、重做后原来的选中项可能已不存在，此时回到主题信息。
  const active: Selection = selectedPatch ? selection : { type: 'theme' }

  useEffect(() => {
    // 首次渲染的主题来自草稿本身；读不出的草稿在用户改动前保留，避免被空主题覆盖。
    if (theme === initial.theme) return
    try {
      localStorage.setItem(DRAFT_KEY, yaml)
      setDraftSaved(true)
      setDraftError(null)
    } catch (error) {
      setDraftError(errorMessage(error))
    }
  }, [theme, yaml, initial.theme])

  useEffect(() => {
    // 移除后又有其他改动时，提示里的撤销不再对应这次移除。
    if (removal.open && theme !== removal.after) setRemoval((previous) => ({ ...previous, open: false }))
  }, [theme, removal.open, removal.after])

  function select(next: Selection) {
    setSelection(next)
    setEditorKey((key) => key + 1)
  }

  function change(update: (theme: WalTheme) => WalTheme, merge?: string) {
    dispatch({ type: 'update', update, merge })
  }

  const handleCheckpoint = useCallback(() => dispatch({ type: 'checkpoint' }), [])
  const handleUndo = useCallback(() => dispatch({ type: 'undo' }), [])
  const handleRedo = useCallback(() => dispatch({ type: 'redo' }), [])

  function handleNew() {
    change(createTheme)
    select({ type: 'theme' })
    setImportError(null)
  }

  async function handleImport(file: File) {
    setImporting(true)
    setImportError(null)
    try {
      const next = readTheme(await file.text())
      change(() => next)
      select({ type: 'theme' })
    } catch (error) {
      setImportError(`无法导入 ${file.name}：${errorMessage(error)}`)
    } finally {
      setImporting(false)
    }
  }

  const handleExport = useCallback(() => {
    const url = URL.createObjectURL(new Blob([yaml], { type: 'application/yaml;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = exportName(theme)
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [theme, yaml])

  function handleMeta(field: MetaField, value: string) {
    change((theme) => ({ ...theme, [field]: value }), `meta:${field}`)
  }

  function handleSelectTheme() {
    select({ type: 'theme' })
  }

  function handleSelectPatch(path: string, index: number) {
    if (active.type === 'patch' && active.path === path && active.index === index) return
    select({ type: 'patch', path, index })
  }

  function handleAddPatch() {
    const paths = Object.keys(theme.asarPatches)
    const path = active.type === 'patch' ? active.path : (paths[paths.length - 1] ?? DEFAULT_ARCHIVE)
    const index = theme.asarPatches[path]?.length ?? 0
    dispatch({ type: 'checkpoint' })
    change((theme) => addPatch(theme, path, createPatch('main-script')))
    select({ type: 'patch', path, index })
    setFocusRequest('target')
  }

  function handleUpdatePatch(update: (patch: WalAsarPatch) => WalAsarPatch, field?: string) {
    if (active.type !== 'patch') return
    const { path, index } = active
    dispatch({
      type: 'update',
      update: (theme) => updatePatch(theme, path, index, update),
      merge: field && `${patchKey(path, index)}:${field}`,
    })
  }

  function handleMoveArchive(toPath: string) {
    if (active.type !== 'patch' || toPath === active.path) return
    const index = theme.asarPatches[toPath]?.length ?? 0
    const { path, index: from } = active
    dispatch({ type: 'checkpoint' })
    change((theme) => movePatch(theme, path, from, toPath))
    setSelection({ type: 'patch', path: toPath, index })
  }

  function handleRemovePatch() {
    if (active.type !== 'patch' || !selectedPatch) return
    const target = selectedPatch.kind === 'main-script' ? selectedPatch.subject : selectedPatch.path
    const after = removePatch(theme, active.path, active.index)
    dispatch({ type: 'checkpoint' })
    change(() => after)
    select(selectionAfterRemove(theme, active.path, active.index))
    setRemoval((previous) => ({
      open: true,
      label: target || '未填写目标的补丁',
      serial: previous.serial + 1,
      after,
      at: active,
    }))
    setFocusRequest('outline')
  }

  function handleUndoRemoval() {
    if (theme === removal.after) {
      dispatch({ type: 'undo' })
      if (removal.at) select(removal.at)
      setFocusRequest('outline')
    }
    setRemoval((previous) => ({ ...previous, open: false }))
  }

  function handleCloseRemoval() {
    setRemoval((previous) => ({ ...previous, open: false }))
  }

  async function handleCopyBrokenDraft() {
    if (!brokenDraft) return
    try {
      await navigator.clipboard.writeText(brokenDraft.text)
      setBrokenCopy('已复制草稿原文')
    } catch (error) {
      setBrokenCopy(`复制失败：${errorMessage(error)}`)
    }
  }

  function handleDismissBrokenDraft() {
    setBrokenDraft(null)
    setBrokenCopy(null)
  }

  function handleDismissImportError() {
    setImportError(null)
  }

  const handleFocusHandled = useCallback(() => setFocusRequest(null), [])

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      const key = event.key.toLowerCase()
      if (key === 's') {
        event.preventDefault()
        handleExport()
        return
      }
      if (key !== 'z' && key !== 'y') return
      const target = event.target
      // 文本框内保留浏览器自己的撤销，避免与光标位置冲突。
      if (target instanceof HTMLElement && (target.closest('input, textarea, select') || target.isContentEditable))
        return
      event.preventDefault()
      dispatch({ type: key === 'y' || event.shiftKey ? 'redo' : 'undo' })
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleExport])

  return {
    theme,
    yaml,
    selection: active,
    editorKey,
    selectedPatch,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    importing,
    importError,
    brokenDraft,
    brokenCopy,
    draft: { saved: draftSaved, error: draftError },
    focusRequest,
    removal,
    handleImport,
    handleNew,
    handleExport,
    handleUndo,
    handleRedo,
    handleCheckpoint,
    handleMeta,
    handleSelectTheme,
    handleSelectPatch,
    handleAddPatch,
    handleUpdatePatch,
    handleMoveArchive,
    handleRemovePatch,
    handleUndoRemoval,
    handleCloseRemoval,
    handleCopyBrokenDraft,
    handleDismissBrokenDraft,
    handleDismissImportError,
    handleFocusHandled,
  }
}

export type Editor = ReturnType<typeof useEditor>
