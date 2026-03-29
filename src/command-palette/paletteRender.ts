import { escapeHtml } from './htmlUtils'

/**
 * CSS for the shadow-root palette (glass panel, list, variables, animations).
 *
 * @returns A string suitable inside `<style>...</style>`
 */
export function getSpotlightStyles(): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Outfit:wght@400;600;700&family=Syne:wght@600;700;800&display=swap');

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
      background: rgba(5, 5, 6, 0.55);
      backdrop-filter: blur(12px) saturate(180%);
      -webkit-backdrop-filter: blur(12px) saturate(180%);
      opacity: 0;
      transition: opacity 0.28s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .backdrop.backdrop--visible {
      opacity: 1;
    }
    .backdrop.backdrop--leaving {
      opacity: 0;
      transition: opacity 0.22s ease-in;
    }
    .panel {
      position: relative;
      width: min(800px, calc(100vw - 24px));
      max-height: min(72vh, 640px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border-radius: 18px;
      background: rgba(12, 12, 14, 0.78);
      border: 1px solid rgba(232, 121, 249, 0.28);
      box-shadow:
        0 0 0 1px rgba(34, 211, 238, 0.1) inset,
        0 0 56px -12px rgba(232, 121, 249, 0.4),
        0 28px 90px rgba(0, 0, 0, 0.72);
      color: #f4f4f5;
      transform: translateY(14px) scale(0.97);
      opacity: 0;
      transition:
        transform 0.32s cubic-bezier(0.22, 1, 0.36, 1),
        opacity 0.28s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .backdrop.backdrop--visible .panel {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
    .backdrop.backdrop--leaving .panel {
      transform: translateY(10px) scale(0.98);
      opacity: 0;
      transition: transform 0.2s ease-in, opacity 0.2s ease-in;
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
    .folder-filter-wrap {
      padding: 0 16px 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .folder-filter-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: rgba(161, 161, 170, 0.9);
    }
    .folder-filter {
      width: 100%;
      border-radius: 10px;
      border: 1px solid rgba(63, 63, 70, 0.95);
      background: rgba(0, 0, 0, 0.45);
      color: #fafafa;
      font-size: 13px;
      padding: 10px 12px;
      outline: none;
      cursor: pointer;
    }
    .folder-filter:focus {
      border-color: rgba(34, 211, 238, 0.45);
      box-shadow: 0 0 0 2px rgba(34, 211, 238, 0.15);
    }
    .folder-filter:disabled {
      opacity: 0.7;
      cursor: wait;
    }
    .item-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .folder-badge {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 2px 8px;
      border-radius: 6px;
      background: rgba(99, 102, 241, 0.2);
      border: 1px solid rgba(129, 140, 248, 0.35);
      color: rgba(196, 181, 253, 0.95);
      max-width: 140px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
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
    .search:disabled,
    .search--loading {
      opacity: 0.72;
      cursor: wait;
    }
    .search-body {
      display: flex;
      flex: 1;
      min-height: 0;
      align-items: stretch;
    }
    .list {
      flex: 1;
      min-width: 0;
      overflow: auto;
      padding: 6px 10px 14px;
    }
    .preview-pane {
      width: min(268px, 34vw);
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px 14px 14px;
      border-left: 1px solid rgba(63, 63, 70, 0.65);
      background: rgba(0, 0, 0, 0.22);
    }
    .preview-label {
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: rgba(52, 211, 153, 0.7);
      margin: 0;
    }
    .preview-title {
      font-family: 'Syne', 'Outfit', sans-serif;
      font-size: 13px;
      font-weight: 700;
      color: #fafafa;
      line-height: 1.3;
      margin: 0;
    }
    .preview-empty {
      font-size: 12px;
      color: rgba(161, 161, 170, 0.75);
      line-height: 1.45;
    }
    .preview-body {
      flex: 1;
      min-height: 120px;
      overflow: auto;
      margin: 0;
      font-size: 12px;
      line-height: 1.55;
      color: rgba(228, 228, 231, 0.92);
      white-space: pre-wrap;
      word-break: break-word;
    }
    @media (max-width: 620px) {
      .preview-pane {
        display: none;
      }
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
      background: rgba(24, 24, 27, 0.55);
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
      font-size: 11px;
      line-height: 1.35;
      color: rgba(161, 161, 170, 0.85);
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .ph-mono {
      font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.92em;
      font-weight: 600;
      letter-spacing: -0.02em;
      color: rgba(167, 243, 208, 0.95);
      background: rgba(16, 185, 129, 0.12);
      border-radius: 4px;
      padding: 0 3px;
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
    .field .label-mono {
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 11px;
      letter-spacing: 0.04em;
      text-transform: none;
      font-weight: 600;
      color: rgba(167, 243, 208, 0.95);
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
    .field input::placeholder {
      font-family: 'JetBrains Mono', ui-monospace, monospace;
      font-size: 12px;
      opacity: 0.55;
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

/**
 * Full shadow-root HTML for search mode (style + backdrop shell).
 *
 * @returns HTML string assigned to `shadowRoot.innerHTML`
 */
export function renderPaletteSearchShell(): string {
  return `
    <style>${getSpotlightStyles()}</style>
    <div class="backdrop" data-backdrop>
      <div class="panel" data-panel>
        <div class="panel-header">
          <strong>PromptBolt</strong>
          <span>Palette</span>
          <span class="hint">↵ select · ↑↓ · esc</span>
        </div>
        <div class="folder-filter-wrap">
          <label class="folder-filter-label" for="pfolder-filter">Folder</label>
          <select
            class="folder-filter"
            data-folder-filter
            id="pfolder-filter"
            aria-label="Filter by folder"
          ></select>
        </div>
        <div class="search-wrap">
          <input
            class="search"
            type="search"
            data-search
            placeholder="Search prompts (fuzzy)…"
            spellcheck="false"
            autocomplete="off"
          />
        </div>
        <div class="search-body">
          <div class="list" data-list></div>
          <aside class="preview-pane" aria-label="Prompt preview">
            <p class="preview-label">Preview</p>
            <p class="preview-title" data-preview-title>—</p>
            <div class="preview-body" data-preview></div>
          </aside>
        </div>
      </div>
    </div>
  `
}

export type VariableFieldDescriptor = { label: string; index: number }

/**
 * Builds variable-step inner HTML (fields only — wrapped by {@link renderPaletteVariableShell}).
 *
 * @param fields - Placeholder labels in order
 */
export function buildVariableFieldsFragment(fields: string[]): string {
  return fields
    .map((label, idx) => {
      const safe = escapeHtml(label)
      return `
      <div class="field">
        <label class="label-mono" for="var-${idx}">[${safe}]</label>
        <input
          id="var-${idx}"
          type="text"
          data-var-index="${idx}"
          placeholder="Value for [${safe}]"
        />
      </div>
    `
    })
    .join('')
}

/**
 * Full shadow-root HTML for the variable substitution step.
 *
 * @param promptTitle - Escaped elsewhere; passed raw and escaped here
 * @param fieldsHtml - From {@link buildVariableFieldsFragment}
 */
export function renderPaletteVariableShell(
  promptTitle: string,
  fieldsHtml: string,
): string {
  const title = escapeHtml(promptTitle)
  return `
    <style>${getSpotlightStyles()}</style>
    <div class="backdrop backdrop--visible" data-backdrop>
      <div class="panel" data-panel>
        <div class="panel-header">
          <strong>Variables</strong>
          <span>${title}</span>
          <span class="hint">esc · cancel</span>
        </div>
        <div class="var-panel">
          <div class="var-hint">Fill each placeholder, then insert into the focused field.</div>
          ${fieldsHtml}
          <div class="actions">
            <button type="button" class="btn" data-cancel>Cancel</button>
            <button type="button" class="btn btn--primary" data-insert>Insert</button>
          </div>
        </div>
      </div>
    </div>
  `
}
