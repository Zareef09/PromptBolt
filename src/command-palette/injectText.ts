/**
 * @fileoverview High-compatibility text insertion for extension content scripts.
 * Handles native inputs, textareas, and contenteditable surfaces used by Gmail,
 * ChatGPT, LinkedIn, and similar apps, then dispatches bubbling lifecycle events
 * so React/Vue/Prose-style state layers observe the edit.
 */

/** Element that had focus before the palette opened (may be outside our shadow root). */
let focusSnapshot: Element | null = null

/**
 * Remembers `document.activeElement` so we can restore focus after the palette closes.
 */
export function captureTargetElement(): void {
  try {
    focusSnapshot = document.activeElement
  } catch {
    focusSnapshot = null
  }
}

/**
 * Focuses the previously captured element on the next frame (after DOM changes settle).
 */
export function restoreTargetFocus(): void {
  const el = focusSnapshot
  focusSnapshot = null
  requestAnimationFrame(() => {
    if (el && el.isConnected && el instanceof HTMLElement) {
      try {
        el.focus()
      } catch {
        /* ignore: restricted or unfocusable */
      }
    }
  })
}

export type InjectResult =
  | { ok: true }
  | { ok: false; error: string }

function getInputValueSetter(
  el: HTMLInputElement | HTMLTextAreaElement,
): ((v: string) => void) | undefined {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype
  return Object.getOwnPropertyDescriptor(proto, 'value')?.set
}

/**
 * Dispatches synthetic `input`, `change`, and `blur` events with bubbling enabled
 * so delegated listeners and framework bindings (e.g. React) run after DOM updates.
 *
 * @param target - Node that received the edit (input, textarea, or contenteditable host)
 */
export function dispatchEditorLifecycleEvents(target: EventTarget): void {
  target.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      cancelable: true,
    }),
  )
  target.dispatchEvent(new Event('change', { bubbles: true }))
  target.dispatchEvent(new Event('blur', { bubbles: true }))
}

function injectIntoField(el: HTMLInputElement | HTMLTextAreaElement, text: string): void {
  el.focus()
  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? el.value.length
  const next = el.value.slice(0, start) + text + el.value.slice(end)

  const nativeSet = getInputValueSetter(el)
  if (nativeSet) {
    nativeSet.call(el, next)
  } else {
    el.value = next
  }

  const caret = start + text.length
  if (typeof el.setSelectionRange === 'function') {
    try {
      el.setSelectionRange(caret, caret)
    } catch {
      /* e.g. type="email" */
    }
  }

  dispatchEditorLifecycleEvents(el)
}

function placeCaretAtEnd(el: HTMLElement): void {
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  const sel = window.getSelection()
  if (sel) {
    sel.removeAllRanges()
    sel.addRange(range)
  }
}

function selectionInsideHost(
  host: HTMLElement,
  sel: Selection | null,
): boolean {
  if (!sel || sel.rangeCount === 0) return false
  const node = sel.anchorNode
  if (!node) return false
  return host.contains(node.nodeType === Node.TEXT_NODE ? node.parentNode : node)
}

function injectIntoContentEditable(host: HTMLElement, text: string): void {
  host.focus()

  const sel = window.getSelection()
  if (!selectionInsideHost(host, sel)) {
    placeCaretAtEnd(host)
  }

  const ok = document.execCommand('insertText', false, text)

  if (!ok) {
    const nextSel = window.getSelection()
    if (nextSel && nextSel.rangeCount > 0) {
      const range = nextSel.getRangeAt(0)
      if (host.contains(range.commonAncestorContainer)) {
        range.deleteContents()
        range.insertNode(document.createTextNode(text))
        range.collapse(false)
        nextSel.removeAllRanges()
        nextSel.addRange(range)
      }
    }
  }

  dispatchEditorLifecycleEvents(host)
}

/**
 * Inserts plain text into the focused control, preferring the pre-palette focus snapshot.
 *
 * @param text - Final string to insert (after any variable substitution).
 * @returns `{ ok: true }` on success, or `{ ok: false, error }` if the page blocks edits.
 */
export function injectTextIntoEditableTarget(text: string): InjectResult {
  try {
    const preferred =
      focusSnapshot && focusSnapshot.isConnected
        ? focusSnapshot
        : document.activeElement

    const el = preferred
    if (!el) {
      return { ok: false, error: 'No active field to paste into.' }
    }

    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      if (el.readOnly || el.disabled) {
        return { ok: false, error: 'That field is read-only or disabled.' }
      }
      injectIntoField(el, text)
      return { ok: true }
    }

    if (el instanceof HTMLElement && el.isContentEditable) {
      injectIntoContentEditable(el, text)
      return { ok: true }
    }

    return {
      ok: false,
      error: 'Focus a text box or editable area, then try again.',
    }
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.message
        : 'Could not insert text on this page (it may be restricted).'
    return { ok: false, error: msg }
  }
}
