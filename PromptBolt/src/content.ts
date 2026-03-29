type Prompt = {
  id: string
  title: string
  content: string
}

const PROMPTS_KEY = 'prompts'
const HOST_ID = 'promptbolt-overlay-host'

let host: HTMLDivElement | null = null
let shadow: ShadowRoot | null = null
let overlayOpen = false

function getPromptsFromStorage(): Promise<Prompt[]> {
  return new Promise((resolvePromise) => {
    chrome.storage.local.get([PROMPTS_KEY], (res) => {
      const list = res[PROMPTS_KEY]
      resolvePromise(Array.isArray(list) ? (list as Prompt[]) : [])
    })
  })
}

function insertIntoActiveField(text: string): void {
  const el = document.activeElement
  if (!el) return

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    el.value = el.value.slice(0, start) + text + el.value.slice(end)
    el.selectionStart = el.selectionEnd = start + text.length
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return
  }

  if (el instanceof HTMLElement && el.isContentEditable) {
    document.execCommand('insertText', false, text)
  }
}

function removeOverlay(): void {
  overlayOpen = false
  host?.remove()
  host = null
  shadow = null
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderOverlay(prompts: Prompt[], filter: string): void {
  if (!shadow) return

  const q = filter.trim().toLowerCase()
  const filtered = q
    ? prompts.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q),
      )
    : prompts

  const brand = '#4f46e5'

  shadow.innerHTML = `
    <style>
      * { box-sizing: border-box; }
      :host { all: initial; }
      .backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.45);
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 10vh 16px;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        z-index: 2147483646;
      }
      .panel {
        width: min(480px, 100%);
        max-height: min(70vh, 560px);
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid #e5e7eb;
      }
      .header {
        padding: 12px 14px;
        border-bottom: 1px solid #e5e7eb;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .title { font-weight: 600; color: #111827; font-size: 15px; }
      .kbd { font-size: 11px; color: #6b7280; margin-left: auto; }
      .search {
        margin: 0 14px 12px;
        margin-top: 12px;
        padding: 10px 12px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-size: 14px;
        outline: none;
        width: calc(100% - 28px);
      }
      .search:focus {
        border-color: ${brand};
        box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.2);
      }
      .list {
        overflow: auto;
        flex: 1;
        padding: 0 8px 12px;
      }
      .item {
        width: 100%;
        text-align: left;
        padding: 10px 12px;
        margin-bottom: 6px;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
        background: #f9fafb;
        cursor: pointer;
        font: inherit;
      }
      .item:hover { border-color: ${brand}; background: #eef2ff; }
      .item-title { font-weight: 600; color: #111827; font-size: 14px; margin-bottom: 4px; }
      .item-preview { font-size: 12px; color: #6b7280; line-height: 1.35;
        display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .empty { padding: 24px; text-align: center; color: #6b7280; font-size: 14px; }
    </style>
    <div class="backdrop" data-backdrop>
      <div class="panel" data-panel>
        <div class="header">
          <span class="title">PromptBolt</span>
          <span class="kbd">Esc to close</span>
        </div>
        <input type="search" class="search" placeholder="Search prompts…" data-search value="${escapeHtml(filter)}" autofocus />
        <div class="list" data-list></div>
      </div>
    </div>
  `

  const listEl = shadow.querySelector('[data-list]')
  const searchInput = shadow.querySelector<HTMLInputElement>('[data-search]')
  const backdrop = shadow.querySelector('[data-backdrop]')

  if (!listEl) return

  if (filtered.length === 0) {
    listEl.innerHTML =
      '<div class="empty">No prompts match your search.</div>'
  } else {
    listEl.innerHTML = filtered
      .map(
        (p) => `
        <button type="button" class="item" data-id="${p.id.replace(/"/g, '&quot;')}">
          <div class="item-title">${escapeHtml(p.title)}</div>
          <div class="item-preview">${escapeHtml(p.content)}</div>
        </button>
      `,
      )
      .join('')
    for (const btn of listEl.querySelectorAll<HTMLButtonElement>(
      'button[data-id]',
    )) {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id')
        const prompt = prompts.find((p) => p.id === id)
        if (prompt) insertIntoActiveField(prompt.content)
        removeOverlay()
      })
    }
  }

  searchInput?.addEventListener('input', () => {
    void getPromptsFromStorage().then((next) =>
      renderOverlay(next, searchInput.value),
    )
  })

  backdrop?.addEventListener('click', (e) => {
    if (e.target === backdrop) removeOverlay()
  })
}

async function toggleOverlay(): Promise<void> {
  if (overlayOpen) {
    removeOverlay()
    return
  }

  overlayOpen = true
  const prompts = await getPromptsFromStorage()

  host = document.createElement('div')
  host.id = HOST_ID
  shadow = host.attachShadow({ mode: 'open' })
  document.documentElement.appendChild(host)

  renderOverlay(prompts, '')
}

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
      void toggleOverlay()
    } else if (e.key === 'Escape' && overlayOpen) {
      e.preventDefault()
      removeOverlay()
    }
  },
  true,
)
