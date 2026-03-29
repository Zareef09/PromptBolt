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
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&family=Syne:wght@600;700;800&display=swap');

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
      font-family: 'Outfit', ui-sans-serif, system-ui, sans-serif;
      background: rgba(5, 5, 6, 0.62);
      backdrop-filter: saturate(1.75) blur(20px);
      -webkit-backdrop-filter: saturate(1.75) blur(20px);
    }
    .panel {
      width: min(560px, 100%);
      max-height: min(72vh, 620px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border-radius: 16px;
      background: rgba(12, 12, 14, 0.92);
      border: 1px solid rgba(232, 121, 249, 0.22);
      box-shadow:
        0 0 0 1px rgba(34, 211, 238, 0.08) inset,
        0 0 48px -12px rgba(232, 121, 249, 0.35),
        0 24px 80px rgba(0, 0, 0, 0.65);
      color: #f4f4f5;
    }
    .panel-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px 0;
      font-size: 10px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      font-weight: 700;
      font-family: 'Syne', 'Outfit', sans-serif;
      color: rgba(244, 244, 245, 0.45);
    }
    .panel-header strong {
      background: linear-gradient(90deg, #f472b6, #a78bfa, #22d3ee);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      font-weight: 800;
    }
    .hint {
      margin-left: auto;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.08em;
      color: rgba(190, 242, 100, 0.75);
    }
    .search-wrap {
      padding: 12px 16px 8px;
    }
    .search {
      width: 100%;
      border-radius: 12px;
      border: 1px solid rgba(63, 63, 70, 0.9);
      background: rgba(0, 0, 0, 0.45);
      color: #fafafa;
      font-size: 15px;
      line-height: 1.35;
      padding: 12px 14px;
      outline: none;
      transition: box-shadow 0.15s ease, border-color 0.15s ease;
    }
    .search::placeholder {
      color: rgba(161, 161, 170, 0.65);
    }
    .search:focus {
      border-color: rgba(232, 121, 249, 0.55);
      box-shadow:
        0 0 0 2px rgba(232, 121, 249, 0.28),
        0 0 28px -6px rgba(34, 211, 238, 0.25);
    }
    .list {
      flex: 1;
      overflow: auto;
      padding: 6px 10px 14px;
    }
    .item {
      width: 100%;
      text-align: left;
      border: 0;
      cursor: pointer;
      font: inherit;
      color: inherit;
      border-radius: 12px;
      padding: 11px 13px;
      margin-bottom: 6px;
      background: rgba(24, 24, 27, 0.65);
      border: 1px solid rgba(39, 39, 42, 0.95);
      transition: background 0.12s ease, border-color 0.12s ease, transform 0.06s ease,
        box-shadow 0.12s ease;
    }
    .item:hover {
      border-color: rgba(232, 121, 249, 0.25);
      background: rgba(39, 39, 42, 0.55);
    }
    .item--selected {
      background: rgba(232, 121, 249, 0.12);
      border-color: rgba(167, 139, 250, 0.55);
      box-shadow: 0 0 24px -8px rgba(232, 121, 249, 0.45);
    }
    .item-title {
      font-family: 'Syne', 'Outfit', sans-serif;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 4px;
      color: #fafafa;
    }
    .item-preview {
      font-size: 12px;
      line-height: 1.4;
      color: rgba(161, 161, 170, 0.95);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .empty {
      padding: 28px 16px;
      text-align: center;
      font-size: 13px;
      line-height: 1.5;
      color: rgba(161, 161, 170, 0.8);
    }
    .var-panel {
      padding: 16px 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: min(62vh, 520px);
      overflow: auto;
    }
    .var-title {
      font-size: 13px;
      font-weight: 600;
      color: rgba(250, 250, 250, 0.95);
    }
    .var-hint {
      font-size: 11px;
      line-height: 1.45;
      color: rgba(244, 114, 182, 0.85);
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .field label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: rgba(190, 242, 100, 0.85);
    }
    .field input {
      border-radius: 12px;
      border: 1px solid rgba(63, 63, 70, 0.95);
      background: rgba(0, 0, 0, 0.4);
      color: #fafafa;
      font-size: 14px;
      padding: 11px 12px;
      outline: none;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .field input:focus {
      border-color: rgba(34, 211, 238, 0.5);
      box-shadow: 0 0 0 2px rgba(34, 211, 238, 0.18);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 8px;
    }
    .btn {
      border-radius: 12px;
      padding: 10px 16px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      font-family: 'Syne', 'Outfit', sans-serif;
      cursor: pointer;
      border: 1px solid rgba(63, 63, 70, 0.95);
      background: rgba(24, 24, 27, 0.8);
      color: rgba(244, 244, 245, 0.9);
      transition: border-color 0.12s ease, background 0.12s ease;
    }
    .btn:hover {
      border-color: rgba(244, 114, 182, 0.45);
      background: rgba(39, 39, 42, 0.9);
    }
    .btn--primary {
      border: 1px solid rgba(232, 121, 249, 0.45);
      background: linear-gradient(135deg, #c026d3 0%, #7c3aed 50%, #0891b2 100%);
      color: #fff;
      box-shadow: 0 8px 32px rgba(192, 38, 211, 0.35);
    }
    .btn--primary:hover {
      filter: brightness(1.08);
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
          <strong>Bolt</strong>
          <span>palette</span>
          <span class="hint">↵ send it · ↑↓ vibe check · esc bounce</span>
        </div>
        <div class="search-wrap">
          <input
            class="search"
            type="search"
            data-search
            placeholder="Search your stash…"
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
          <strong>Variables</strong>
          <span>${escapeHtml(prompt.title)}</span>
          <span class="hint">esc nah</span>
        </div>
        <div class="var-panel">
          <div class="var-hint">Fill the [brackets] — then we inject the final text fr fr</div>
          ${fieldsHtml}
          <div class="actions">
            <button type="button" class="btn" data-cancel>Nah</button>
            <button type="button" class="btn btn--primary" data-insert>Send it</button>
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
