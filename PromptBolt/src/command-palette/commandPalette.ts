import { applyPlaceholderReplacements, extractUniquePlaceholders } from './parseVariables'
import {
  captureTargetElement,
  injectTextIntoEditableTarget,
  restoreTargetFocus,
} from './injectText'
import { escapeHtml } from './htmlUtils'
import type { PaletteMode, Prompt } from './types'
import { PROMPTS_STORAGE_KEY } from './types'

const HOST_ID = 'promptbolt-palette-host'

let host: HTMLDivElement | null = null
let shadow: ShadowRoot | null = null
let isOpen = false

let allPrompts: Prompt[] = []
let filtered: Prompt[] = []
let filterText = ''
let selectedIndex = 0
let mode: PaletteMode = 'search'
let pendingPrompt: Prompt | null = null
let pendingPlaceholders: string[] = []

function fetchPrompts(): Promise<Prompt[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get([PROMPTS_STORAGE_KEY], (res) => {
      const list = res[PROMPTS_STORAGE_KEY]
      resolve(Array.isArray(list) ? (list as Prompt[]) : [])
    })
  })
}

function spotlightStyles(): string {
  return `
    * { box-sizing: border-box; }
    :host { all: initial; }
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 2147483646;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 12vh 16px;
      font-family: ui-sans-serif, system-ui, -apple-system, "SF Pro Text", "Segoe UI",
        Roboto, sans-serif;
      background: rgba(0, 0, 0, 0.38);
      backdrop-filter: saturate(1.6) blur(22px);
      -webkit-backdrop-filter: saturate(1.6) blur(22px);
    }
    .panel {
      width: min(560px, 100%);
      max-height: min(72vh, 620px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border-radius: 12px;
      background: rgba(32, 32, 38, 0.78);
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.06) inset,
        0 24px 90px rgba(0, 0, 0, 0.55);
      color: #f5f5f7;
    }
    .panel-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px 0;
      font-size: 11px;
      letter-spacing: 0.02em;
      color: rgba(245, 245, 247, 0.55);
    }
    .panel-header strong {
      color: rgba(245, 245, 247, 0.88);
      font-weight: 600;
    }
    .hint {
      margin-left: auto;
      font-variant-numeric: tabular-nums;
    }
    .search-wrap {
      padding: 12px 14px 8px;
    }
    .search {
      width: 100%;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(255, 255, 255, 0.06);
      color: #f5f5f7;
      font-size: 15px;
      line-height: 1.35;
      padding: 11px 13px;
      outline: none;
      transition: box-shadow 0.12s ease, border-color 0.12s ease;
    }
    .search::placeholder {
      color: rgba(245, 245, 247, 0.35);
    }
    .search:focus {
      border-color: rgba(99, 102, 241, 0.55);
      box-shadow:
        0 0 0 2px rgba(99, 102, 241, 0.38),
        0 0 0 1px rgba(99, 102, 241, 0.18) inset;
    }
    .list {
      flex: 1;
      overflow: auto;
      padding: 6px 8px 12px;
    }
    .item {
      width: 100%;
      text-align: left;
      border: 0;
      cursor: pointer;
      font: inherit;
      color: inherit;
      border-radius: 10px;
      padding: 10px 12px;
      margin-bottom: 4px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid transparent;
      transition: background 0.1s ease, border-color 0.1s ease, transform 0.05s ease;
    }
    .item:hover {
      background: rgba(255, 255, 255, 0.06);
    }
    .item--selected {
      background: rgba(99, 102, 241, 0.22);
      border-color: rgba(129, 140, 248, 0.45);
      box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.12) inset;
    }
    .item-title {
      font-size: 14px;
      font-weight: 600;
      letter-spacing: -0.01em;
      margin-bottom: 4px;
      color: rgba(245, 245, 247, 0.95);
    }
    .item-preview {
      font-size: 12px;
      line-height: 1.35;
      color: rgba(245, 245, 247, 0.5);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .empty {
      padding: 28px 16px;
      text-align: center;
      font-size: 13px;
      color: rgba(245, 245, 247, 0.45);
    }
    .var-panel {
      padding: 14px 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: min(62vh, 520px);
      overflow: auto;
    }
    .var-title {
      font-size: 13px;
      font-weight: 600;
      color: rgba(245, 245, 247, 0.9);
    }
    .var-hint {
      font-size: 11px;
      color: rgba(245, 245, 247, 0.45);
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .field label {
      font-size: 11px;
      color: rgba(245, 245, 247, 0.55);
    }
    .field input {
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(255, 255, 255, 0.06);
      color: #f5f5f7;
      font-size: 14px;
      padding: 10px 11px;
      outline: none;
    }
    .field input:focus {
      border-color: rgba(99, 102, 241, 0.55);
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.35);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 6px;
    }
    .btn {
      border-radius: 10px;
      padding: 9px 14px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid rgba(255, 255, 255, 0.12);
      background: rgba(255, 255, 255, 0.06);
      color: rgba(245, 245, 247, 0.9);
    }
    .btn--primary {
      border-color: rgba(99, 102, 241, 0.55);
      background: linear-gradient(
        180deg,
        rgba(99, 102, 241, 0.9) 0%,
        rgba(79, 70, 229, 0.92) 100%
      );
      color: #fff;
      box-shadow: 0 6px 20px rgba(79, 70, 229, 0.28);
    }
    .btn--primary:hover {
      filter: brightness(1.03);
    }
  `
}

function closePalette(): void {
  isOpen = false
  mode = 'search'
  pendingPrompt = null
  pendingPlaceholders = []
  filterText = ''
  selectedIndex = 0
  filtered = []
  document.removeEventListener('keydown', onDocumentKeydownCapture, true)
  host?.remove()
  host = null
  shadow = null
  restoreTargetFocus()
}

function applyFilter(): void {
  const q = filterText.trim().toLowerCase()
  filtered = q
    ? allPrompts.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q),
      )
    : [...allPrompts]
  selectedIndex = Math.min(
    selectedIndex,
    Math.max(0, filtered.length - 1),
  )
  if (filtered.length && selectedIndex < 0) selectedIndex = 0
}

function mountSearchMode(): void {
  if (!shadow) return
  mode = 'search'
  pendingPrompt = null
  pendingPlaceholders = []

  shadow.innerHTML = `
    <style>${spotlightStyles()}</style>
    <div class="backdrop" data-backdrop>
      <div class="panel" data-panel>
        <div class="panel-header">
          <strong>PromptBolt</strong>
          <span>Command palette</span>
          <span class="hint">↵ insert · ↑↓ navigate · esc close</span>
        </div>
        <div class="search-wrap">
          <input
            class="search"
            type="search"
            data-search
            placeholder="Search prompts…"
            spellcheck="false"
            autocomplete="off"
          />
        </div>
        <div class="list" data-list></div>
      </div>
    </div>
  `

  const searchInput = shadow.querySelector<HTMLInputElement>('[data-search]')
  if (searchInput) {
    searchInput.value = filterText
    searchInput.addEventListener('input', () => {
      filterText = searchInput.value
      selectedIndex = 0
      void fetchPrompts().then((p) => {
        allPrompts = p
        applyFilter()
        paintList()
      })
    })
  }

  const backdrop = shadow.querySelector('[data-backdrop]')
  backdrop?.addEventListener('click', (e) => {
    if (e.target === backdrop) closePalette()
  })

  applyFilter()
  paintList()

  requestAnimationFrame(() => {
    searchInput?.focus()
    searchInput?.select()
  })
}

function paintList(): void {
  if (!shadow || mode !== 'search') return
  const listEl = shadow.querySelector('[data-list]')
  if (!listEl) return

  if (filtered.length === 0) {
    listEl.innerHTML =
      '<div class="empty">No matching prompts. Try a different search.</div>'
    return
  }

  listEl.innerHTML = filtered
    .map(
      (p, i) => `
      <button
        type="button"
        class="item${i === selectedIndex ? ' item--selected' : ''}"
        data-item-index="${i}"
      >
        <div class="item-title">${escapeHtml(p.title)}</div>
        <div class="item-preview">${escapeHtml(p.content)}</div>
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
}

function moveSelection(delta: number): void {
  if (!filtered.length) return
  selectedIndex =
    (selectedIndex + delta + filtered.length) % filtered.length
  paintList()
}

function confirmSelectedPrompt(): void {
  const p = filtered[selectedIndex]
  if (!p) return

  const keys = extractUniquePlaceholders(p.content)
  if (keys.length > 0) {
    mountVariableMode(p, keys)
    return
  }

  injectTextIntoEditableTarget(p.content)
  closePalette()
}

function mountVariableMode(prompt: Prompt, placeholderLabels: string[]): void {
  if (!shadow) return
  pendingPrompt = prompt
  pendingPlaceholders = placeholderLabels
  mode = 'variables'

  const fieldsHtml = placeholderLabels
    .map(
      (label, idx) => `
      <div class="field">
        <label for="var-${idx}">${escapeHtml(label)}</label>
        <input
          id="var-${idx}"
          type="text"
          data-var-index="${idx}"
          placeholder="Value for [${escapeHtml(label)}]"
        />
      </div>
    `,
    )
    .join('')

  shadow.innerHTML = `
    <style>${spotlightStyles()}</style>
    <div class="backdrop" data-backdrop>
      <div class="panel" data-panel>
        <div class="panel-header">
          <strong>Fill variables</strong>
          <span>${escapeHtml(prompt.title)}</span>
          <span class="hint">esc cancel</span>
        </div>
        <div class="var-panel">
          <div class="var-hint">Replace placeholders like [Name] before inserting.</div>
          ${fieldsHtml}
          <div class="actions">
            <button type="button" class="btn" data-cancel>Cancel</button>
            <button type="button" class="btn btn--primary" data-insert>Insert</button>
          </div>
        </div>
      </div>
    </div>
  `

  const backdrop = shadow.querySelector('[data-backdrop]')
  backdrop?.addEventListener('click', (e) => {
    if (e.target === backdrop) closePalette()
  })

  shadow.querySelector('[data-cancel]')?.addEventListener('click', () => {
    void fetchPrompts().then((p) => {
      allPrompts = p
      mountSearchMode()
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
    injectTextIntoEditableTarget(finalText)
    closePalette()
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

function onDocumentKeydownCapture(e: KeyboardEvent): void {
  if (!isOpen || !shadow) return
  const rootShadow = shadow

  const pathTargets = typeof e.composedPath === 'function' ? e.composedPath() : []
  const targetNode = e.target
  const insidePalette =
    (targetNode instanceof Node && rootShadow.contains(targetNode)) ||
    pathTargets.some((n) => n === rootShadow.host)

  if (mode === 'variables') {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      closePalette()
    }
    return
  }

  if (!insidePalette) return

  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    closePalette()
    return
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    e.stopPropagation()
    moveSelection(1)
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    e.stopPropagation()
    moveSelection(-1)
    return
  }

  if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
    const t = e.target
    if (t instanceof HTMLInputElement && t.hasAttribute('data-search')) {
      e.preventDefault()
      e.stopPropagation()
      confirmSelectedPrompt()
    }
  }
}

export async function openCommandPalette(): Promise<void> {
  if (isOpen) return
  captureTargetElement()
  isOpen = true
  filterText = ''
  selectedIndex = 0

  host = document.createElement('div')
  host.id = HOST_ID
  shadow = host.attachShadow({ mode: 'open' })
  document.documentElement.appendChild(host)

  document.addEventListener('keydown', onDocumentKeydownCapture, true)

  allPrompts = await fetchPrompts()
  mountSearchMode()
}

export function toggleCommandPalette(): void {
  if (isOpen) {
    closePalette()
    return
  }
  void openCommandPalette()
}

export function initCommandPalette(): void {
  document.addEventListener(
    'keydown',
    (e) => {
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
    },
    true,
  )
}
