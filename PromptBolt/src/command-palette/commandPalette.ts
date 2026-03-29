import {
  applyPlaceholderReplacements,
  extractUniquePlaceholders,
} from '@services/parsePlaceholders'
import { captureTargetElement, restoreTargetFocus } from './injectText'
import {
  escapeHtml,
  wrapBracketPlaceholdersForPreview,
} from './htmlUtils'
import { showPromptBoltToast } from './toast'
import type { Folder, PaletteMode, PaletteRow, Prompt } from './types'
import { loadFolderStateForPalette } from './paletteFolderLoader'
import { getFilteredPrompts } from './paletteSearch'
import { injectWithAnalytics } from './paletteInjection'
import { pinRowsForSiteContext } from './domainContext'
import {
  buildVariableFieldsFragment,
  renderPaletteSearchShell,
  renderPaletteVariableShell,
} from './paletteRender'

/**
 * Inlined from `storage/lastUsedMap.ts` so the content script stays one bundle
 * (shared module otherwise emits a separate chunk).
 */
const PROMPT_LAST_USED_KEY = 'promptbolt_last_used' as const

/** Inlined (same key as `storage/siteBlacklist.ts`) — avoids a shared chunk. */
const SITE_BLACKLIST_KEY = 'promptbolt_site_blacklist' as const

function parseLastUsedMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
  }
  return out
}

function persistLastUsedMap(map: Record<string, number>): void {
  chrome.storage.local.set({ [PROMPT_LAST_USED_KEY]: map })
}

function parseSiteBlacklistRaw(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (x): x is string => typeof x === 'string' && x.trim().length > 0,
  )
}

/** Cached rules refreshed from storage (and `onChanged`). */
let siteBlacklistRules: string[] = []

function refreshSiteBlacklistFromStorage(): void {
  chrome.storage.local.get([SITE_BLACKLIST_KEY], (res) => {
    const err = chrome.runtime.lastError
    if (err) return
    siteBlacklistRules = parseSiteBlacklistRaw(res[SITE_BLACKLIST_KEY])
  })
}

/**
 * @param hostname - `location.hostname`
 */
function isHostnameBlacklisted(hostname: string): boolean {
  const host = hostname.replace(/^www\./, '').toLowerCase()
  for (let rule of siteBlacklistRules) {
    rule =
      rule
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .split('/')[0] ?? ''
    if (!rule) continue
    if (rule.startsWith('*.')) {
      const suff = rule.slice(2)
      if (host === suff || host.endsWith(`.${suff}`)) return true
      continue
    }
    if (host === rule) return true
  }
  return false
}

const HOST_ID = 'promptbolt-palette-host'
const ALL_FOLDERS_VALUE = '__all__'

let host: HTMLDivElement | null = null
let shadow: ShadowRoot | null = null
let isOpen = false
/** Prevents double teardown while exit animation runs. */
let isClosing = false

let allFolders: Folder[] = []
let allRows: PaletteRow[] = []
let filteredRows: PaletteRow[] = []
let folderFilterId = ALL_FOLDERS_VALUE
let filterText = ''
let selectedIndex = 0
let mode: PaletteMode = 'search'
let pendingPrompt: Prompt | null = null
let pendingPlaceholders: string[] = []
let promptsLoading = false
let lastUsedMap: Record<string, number> = {}

/**
 * Rebuilds the flat palette row list from the current folder tree.
 */
function rebuildRowsFromFolders(): void {
  const rows: PaletteRow[] = []
  for (const f of allFolders) {
    for (const p of f.prompts) {
      rows.push({ folderId: f.id, folderName: f.name, prompt: p })
    }
  }
  allRows = rows
}

/**
 * Reads `promptbolt_last_used` into {@link lastUsedMap}.
 *
 * @returns Resolves when storage read completes
 */
function loadLastUsedFromStorage(): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([PROMPT_LAST_USED_KEY], (res) => {
      const err = chrome.runtime.lastError
      if (err) {
        reject(new Error(err.message))
        return
      }
      lastUsedMap = parseLastUsedMap(res[PROMPT_LAST_USED_KEY])
      resolve()
    })
  })
}

/**
 * Loads folders + last-used timestamps; updates globals on success.
 */
async function fetchPaletteDataSafe(): Promise<void> {
  try {
    const { folders } = await loadFolderStateForPalette()
    allFolders = folders
    rebuildRowsFromFolders()
    await loadLastUsedFromStorage()
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : 'Could not read prompts from storage.'
    console.warn('[PromptBolt] Storage read failed:', msg)
    showPromptBoltToast(
      'Could not load prompts. Check extension permissions and try again.',
      'error',
    )
    allFolders = []
    allRows = []
  }
}

/**
 * Syncs the folder `<select>` options with {@link allFolders}.
 */
function syncFolderFilterSelectOptions(): void {
  const sel = shadow?.querySelector<HTMLSelectElement>('[data-folder-filter]')
  if (!sel) return
  const current = sel.value
  sel.innerHTML = `<option value="${ALL_FOLDERS_VALUE}">All folders</option>`
  for (const f of allFolders) {
    const opt = document.createElement('option')
    opt.value = f.id
    opt.textContent = f.name
    sel.appendChild(opt)
  }
  if (
    current === ALL_FOLDERS_VALUE ||
    allFolders.some((f) => f.id === current)
  ) {
    sel.value = current
  } else {
    sel.value = ALL_FOLDERS_VALUE
    folderFilterId = ALL_FOLDERS_VALUE
  }
}

/**
 * @param error - User-visible error string
 */
function reportInjectionFailure(error: string): void {
  console.warn('[PromptBolt] Injection failed:', error)
  showPromptBoltToast(error, 'error')
}

/**
 * Enables/disables search + folder controls while prompts load.
 */
function updateSearchInteraction(): void {
  const si = shadow?.querySelector<HTMLInputElement>('[data-search]')
  const fs = shadow?.querySelector<HTMLSelectElement>('[data-folder-filter]')
  if (si) {
    si.disabled = promptsLoading
    si.classList.toggle('search--loading', promptsLoading)
    si.setAttribute('aria-busy', promptsLoading ? 'true' : 'false')
  }
  if (fs) {
    fs.disabled = promptsLoading
  }
}

/**
 * Adds entrance animation class to the backdrop after the first paint.
 */
function revealBackdrop(): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      shadow?.querySelector('[data-backdrop]')?.classList.add('backdrop--visible')
    })
  })
}

/**
 * Updates {@link lastUsedMap} for a prompt and persists it.
 *
 * @param promptId - Prompt id
 */
function touchPromptLastUsed(promptId: string): void {
  lastUsedMap = { ...lastUsedMap, [promptId]: Date.now() }
  persistLastUsedMap(lastUsedMap)
}

/**
 * Removes DOM, listeners, and restores focus to the page field captured at open.
 */
function finishPaletteTeardown(): void {
  isOpen = false
  mode = 'search'
  pendingPrompt = null
  pendingPlaceholders = []
  promptsLoading = false
  filterText = ''
  selectedIndex = 0
  filteredRows = []
  folderFilterId = ALL_FOLDERS_VALUE
  document.removeEventListener('keydown', onDocumentKeydownCapture, true)
  try {
    host?.remove()
  } catch {
    /* ignore */
  }
  host = null
  shadow = null
  isClosing = false
  restoreTargetFocus()
}

/**
 * Closes the palette with an exit transition when possible.
 */
function closePalette(): void {
  if (!isOpen || isClosing) return
  const backdrop = shadow?.querySelector('[data-backdrop]')
  if (backdrop && host) {
    isClosing = true
    backdrop.classList.remove('backdrop--visible')
    backdrop.classList.add('backdrop--leaving')
    let finished = false
    const done = (): void => {
      if (finished) return
      finished = true
      finishPaletteTeardown()
    }
    const fallback = window.setTimeout(done, 340)
    backdrop.addEventListener(
      'transitionend',
      (ev: Event) => {
        const te = ev as TransitionEvent
        if (te.propertyName === 'opacity') {
          window.clearTimeout(fallback)
          done()
        }
      },
      { once: true },
    )
  } else {
    finishPaletteTeardown()
  }
}

/**
 * Recomputes {@link filteredRows} from current filters and fuzzy + recency ranking.
 */
function applyFilter(): void {
  const ranked = getFilteredPrompts({
    allRows,
    folderFilterId,
    allFoldersValue: ALL_FOLDERS_VALUE,
    filterText,
    lastUsedMap,
  })
  const host =
    typeof window !== 'undefined' && window.location?.hostname
      ? window.location.hostname
      : ''
  filteredRows = pinRowsForSiteContext(ranked, host)
  selectedIndex = Math.min(
    selectedIndex,
    Math.max(0, filteredRows.length - 1),
  )
  if (filteredRows.length && selectedIndex < 0) selectedIndex = 0
}

/**
 * Injects search-mode markup and wires folder + search listeners.
 */
function mountSearchMode(): void {
  if (!shadow) return
  mode = 'search'
  pendingPrompt = null
  pendingPlaceholders = []

  shadow.innerHTML = renderPaletteSearchShell()

  const folderSelect = shadow.querySelector<HTMLSelectElement>(
    '[data-folder-filter]',
  )
  if (folderSelect) {
    folderSelect.disabled = promptsLoading
    syncFolderFilterSelectOptions()
    folderSelect.addEventListener('change', () => {
      if (promptsLoading) return
      folderFilterId = folderSelect.value
      selectedIndex = 0
      applyFilter()
      paintList()
    })
  }

  const searchInput = shadow.querySelector<HTMLInputElement>('[data-search]')
  if (searchInput) {
    searchInput.value = filterText
    searchInput.addEventListener('input', () => {
      if (promptsLoading) return
      filterText = searchInput.value
      selectedIndex = 0
      applyFilter()
      paintList()
    })
  }

  const backdrop = shadow.querySelector('[data-backdrop]')
  backdrop?.addEventListener('click', (e) => {
    if (e.target === backdrop) closePalette()
  })

  revealBackdrop()
}

/**
 * Renders the prompt list (or empty states) inside the shadow root.
 */
function paintList(): void {
  if (!shadow || mode !== 'search') return
  const listEl = shadow.querySelector('[data-list]')
  if (!listEl) return

  if (promptsLoading) {
    listEl.innerHTML = '<div class="empty">Loading prompts…</div>'
    return
  }

  if (allRows.length === 0) {
    listEl.innerHTML =
      '<div class="empty">No prompts yet. Add prompts in the PromptBolt popup.</div>'
    return
  }

  if (filteredRows.length === 0) {
    listEl.innerHTML =
      '<div class="empty">No prompts match this filter. Try another folder or fuzzy search.</div>'
    return
  }

  listEl.innerHTML = filteredRows
    .map(
      (row, i) => `
      <button
        type="button"
        class="item${i === selectedIndex ? ' item--selected' : ''}"
        data-item-index="${i}"
      >
        <div class="item-meta">
          <span class="folder-badge" title="${escapeHtml(row.folderName)}">${escapeHtml(row.folderName)}</span>
        </div>
        <div class="item-title">${escapeHtml(row.prompt.title)}</div>
        <div class="item-preview">${wrapBracketPlaceholdersForPreview(escapeHtml(row.prompt.content))}</div>
      </button>
    `,
    )
    .join('')

  for (const btn of listEl.querySelectorAll<HTMLButtonElement>(
    'button[data-item-index]',
  )) {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-item-index'))
      if (!Number.isNaN(idx)) {
        selectedIndex = idx
        confirmSelectedPrompt()
      }
    })
  }

  const active = listEl.querySelector(`[data-item-index="${selectedIndex}"]`)
  active?.scrollIntoView({ block: 'nearest' })
  updatePreviewPane()
}

const INJECT_CHECK_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13l4 4L19 7" /></svg>`

/**
 * Brief glass success overlay inside the shadow root before teardown.
 *
 * @param onComplete - Called after the glow/check animation (e.g. {@link closePalette})
 */
function flashInjectionSuccess(onComplete: () => void): void {
  if (!shadow) {
    onComplete()
    return
  }
  const panel = shadow.querySelector('[data-panel]')
  const mount = panel ?? shadow
  const flash = document.createElement('div')
  flash.className = 'inject-flash'
  flash.setAttribute('role', 'presentation')
  flash.innerHTML = `
    <div class="inject-flash__inner">
      <div class="inject-flash__check">${INJECT_CHECK_SVG}</div>
      <span class="inject-flash__label">Inserted</span>
    </div>
  `
  mount.appendChild(flash)
  requestAnimationFrame(() => {
    flash.classList.add('inject-flash--on')
  })
  window.setTimeout(() => {
    flash.classList.remove('inject-flash--on')
    window.setTimeout(() => {
      flash.remove()
      onComplete()
    }, 280)
  }, 520)
}

/**
 * Updates the right-hand preview column for the highlighted row.
 */
function updatePreviewPane(): void {
  if (!shadow || mode !== 'search') return
  const body = shadow.querySelector('[data-preview]')
  const titleEl = shadow.querySelector('[data-preview-title]')
  if (!body || !titleEl) return

  if (promptsLoading || allRows.length === 0 || filteredRows.length === 0) {
    titleEl.textContent = '—'
    body.innerHTML =
      '<span class="preview-empty">No preview available.</span>'
    return
  }

  const row = filteredRows[selectedIndex]
  if (!row) {
    titleEl.textContent = '—'
    body.innerHTML =
      '<span class="preview-empty">Select a prompt to preview full text.</span>'
    return
  }

  titleEl.textContent = row.prompt.title
  body.innerHTML = wrapBracketPlaceholdersForPreview(
    escapeHtml(row.prompt.content),
  )
}

/**
 * Moves the selection highlight by `delta` (wraps).
 *
 * @param delta - +1 or -1
 */
function moveSelection(delta: number): void {
  if (!filteredRows.length) return
  selectedIndex =
    (selectedIndex + delta + filteredRows.length) % filteredRows.length
  paintList()
}

/**
 * Confirms the highlighted row: variables UI or direct injection.
 */
function confirmSelectedPrompt(): void {
  const row = filteredRows[selectedIndex]
  if (!row) return
  const p = row.prompt

  const keys = extractUniquePlaceholders(p.content)
  if (keys.length > 0) {
    mountVariableMode(p, keys)
    return
  }

  const result = injectWithAnalytics(p.content)
  if (!result.ok) {
    reportInjectionFailure(result.error)
    closePalette()
    return
  }
  touchPromptLastUsed(p.id)
  flashInjectionSuccess(() => closePalette())
}

/**
 * Shows the variable substitution form for a prompt.
 *
 * @param prompt - Prompt to insert after substitution
 * @param placeholderLabels - Unique `[label]` names
 */
function mountVariableMode(prompt: Prompt, placeholderLabels: string[]): void {
  if (!shadow) return
  pendingPrompt = prompt
  pendingPlaceholders = placeholderLabels
  mode = 'variables'

  const fieldsHtml = buildVariableFieldsFragment(placeholderLabels)
  shadow.innerHTML = renderPaletteVariableShell(prompt.title, fieldsHtml)

  const backdrop = shadow.querySelector('[data-backdrop]')
  backdrop?.addEventListener('click', (e) => {
    if (e.target === backdrop) closePalette()
  })

  shadow.querySelector('[data-cancel]')?.addEventListener('click', () => {
    void fetchPaletteDataSafe().then(() => {
      mountSearchMode()
      syncFolderFilterSelectOptions()
      applyFilter()
      paintList()
      updateSearchInteraction()
      requestAnimationFrame(() => {
        const si = shadow?.querySelector<HTMLInputElement>('[data-search]')
        si?.focus()
        si?.select()
      })
    })
  })

  const submit = (): void => {
    if (!pendingPrompt) return
    const values: Record<string, string> = {}
    pendingPlaceholders.forEach((label, idx) => {
      const inp = shadow?.querySelector<HTMLInputElement>(
        `input[data-var-index="${idx}"]`,
      )
      values[label] = inp?.value ?? ''
    })
    const finalText = applyPlaceholderReplacements(
      pendingPrompt.content,
      values,
    )
    const result = injectWithAnalytics(finalText)
    if (!result.ok) {
      reportInjectionFailure(result.error)
      closePalette()
      return
    }
    touchPromptLastUsed(pendingPrompt.id)
    flashInjectionSuccess(() => closePalette())
  }

  shadow.querySelector('[data-insert]')?.addEventListener('click', submit)

  for (const inp of shadow.querySelectorAll<HTMLInputElement>(
    'input[data-var-index]',
  )) {
    inp.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault()
        submit()
      }
    })
  }

  requestAnimationFrame(() => {
    const first = shadow?.querySelector<HTMLInputElement>(
      'input[data-var-index]',
    )
    first?.focus()
  })
}

/**
 * @returns The folder filter `<select>` when present
 */
function paletteFolderFilterSelect(): HTMLSelectElement | null {
  return shadow?.querySelector<HTMLSelectElement>('[data-folder-filter]') ?? null
}

/**
 * @returns Whether keyboard focus is inside the folder dropdown
 */
function isPaletteFolderFilterFocused(): boolean {
  const sel = paletteFolderFilterSelect()
  const active = shadow?.activeElement ?? null
  return Boolean(sel && active === sel)
}

/**
 * Capture-phase handler: global navigation while palette is open (search mode).
 */
function onDocumentKeydownCapture(e: KeyboardEvent): void {
  if (!isOpen || !shadow) return

  if (mode === 'variables') {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      closePalette()
    }
    return
  }

  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    closePalette()
    return
  }

  const folderFilterFocused = isPaletteFolderFilterFocused()

  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (folderFilterFocused) return
    e.preventDefault()
    e.stopPropagation()
    moveSelection(e.key === 'ArrowDown' ? 1 : -1)
    return
  }

  if (
    e.key === 'Enter' &&
    !e.shiftKey &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.altKey
  ) {
    if (folderFilterFocused) return
    if (filteredRows.length === 0) return
    e.preventDefault()
    e.stopPropagation()
    confirmSelectedPrompt()
    return
  }
}

/**
 * Opens the palette: loads data, mounts shadow DOM, focuses search.
 *
 * @returns Promise when initial load and paint complete
 */
export async function openCommandPalette(): Promise<void> {
  if (isOpen) return

  if (
    typeof window !== 'undefined' &&
    isHostnameBlacklisted(window.location.hostname)
  ) {
    showPromptBoltToast('PromptBolt is disabled on this site.', 'info')
    return
  }

  try {
    document.getElementById(HOST_ID)?.remove()
  } catch {
    /* ignore */
  }
  host = null
  shadow = null
  isClosing = false

  captureTargetElement()
  isOpen = true
  filterText = ''
  selectedIndex = 0
  promptsLoading = true
  folderFilterId = ALL_FOLDERS_VALUE
  allFolders = []
  allRows = []

  host = document.createElement('div')
  host.id = HOST_ID
  shadow = host.attachShadow({ mode: 'open' })
  document.documentElement.appendChild(host)

  document.addEventListener('keydown', onDocumentKeydownCapture, true)

  mountSearchMode()
  paintList()
  updateSearchInteraction()

  try {
    await fetchPaletteDataSafe()
  } finally {
    promptsLoading = false
  }
  syncFolderFilterSelectOptions()
  applyFilter()
  paintList()
  updateSearchInteraction()

  requestAnimationFrame(() => {
    const si = shadow?.querySelector<HTMLInputElement>('[data-search]')
    si?.focus()
    si?.select()
  })
}

/**
 * Toggles palette open/closed (used by ⌘⇧K).
 */
export function toggleCommandPalette(): void {
  if (isOpen) {
    closePalette()
    return
  }
  if (
    typeof window !== 'undefined' &&
    isHostnameBlacklisted(window.location.hostname)
  ) {
    showPromptBoltToast('PromptBolt is disabled on this site.', 'info')
    return
  }
  void openCommandPalette().catch((err) => {
    console.warn('[PromptBolt] Failed to open palette', err)
    showPromptBoltToast('Could not open PromptBolt.', 'error')
  })
}

/**
 * Registers ⌘⇧K (capture phase) and keeps the shortcut handler isolated.
 */
export function initCommandPalette(): void {
  refreshSiteBlacklistFromStorage()
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return
      if (changes[SITE_BLACKLIST_KEY]) refreshSiteBlacklistFromStorage()
    })
  } catch {
    /* ignore */
  }
  try {
    document.addEventListener(
      'keydown',
      (e) => {
        try {
          if (
            e.metaKey &&
            e.shiftKey &&
            !e.altKey &&
            !e.ctrlKey &&
            (e.key === 'k' || e.key === 'K')
          ) {
            e.preventDefault()
            e.stopPropagation()
            toggleCommandPalette()
          }
        } catch (err) {
          console.warn('[PromptBolt] Shortcut handler error', err)
        }
      },
      true,
    )
  } catch (e) {
    console.warn('[PromptBolt] initCommandPalette failed', e)
  }
}
