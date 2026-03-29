/**
 * High-compatibility text insertion + lifecycle events for React / Vue / Prose-like editors.
 *
 * Interview notes:
 * - Many SPAs keep state in JS, not the DOM `value`. React often wraps `<input>` with an
 *   internal value tracker; calling the native prototype `value` setter syncs the DOM and tracker
 *   before we emit synthetic events.
 * - We emit `input` → `change` → `blur` with bubbling so both direct and delegated listeners run.
 */

/** Element that had focus before the palette opened (may be outside our shadow root). */
let focusSnapshot: Element | null = null

export function captureTargetElement(): void {
  focusSnapshot = document.activeElement
}

export function restoreTargetFocus(): void {
  const el = focusSnapshot
  focusSnapshot = null
  requestAnimationFrame(() => {
    if (el && el.isConnected && el instanceof HTMLElement) {
      try {
        el.focus()
      } catch {
        /* ignore */
      }
    }
  })
}

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
 * Synthesize editor lifecycle notifications after the DOM has been updated.
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
 * Insert `text` into the saved target (preferred) or the current active element.
 */
export function injectTextIntoEditableTarget(text: string): void {
  const preferred =
    focusSnapshot && focusSnapshot.isConnected ? focusSnapshot : document.activeElement

  const el = preferred
  if (!el) return

  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    if (el.readOnly || el.disabled) return
    injectIntoField(el, text)
    return
  }

  if (el instanceof HTMLElement && el.isContentEditable) {
    injectIntoContentEditable(el, text)
  }
}
