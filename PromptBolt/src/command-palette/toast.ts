/** Light-DOM toast: avoids Shadow DOM so it still shows if the palette host is torn down. */
const TOAST_ID = 'promptbolt-toast'

export type ToastVariant = 'info' | 'error'

/**
 * Shows a short-lived, non-blocking message (e.g. injection blocked on chrome:// or the Web Store).
 */
export function showPromptBoltToast(
  message: string,
  variant: ToastVariant = 'info',
): void {
  try {
    document.getElementById(TOAST_ID)?.remove()

    const el = document.createElement('div')
    el.id = TOAST_ID
    el.setAttribute('role', 'status')
    el.setAttribute('aria-live', 'polite')

    const isErr = variant === 'error'
    el.textContent = message
    el.style.cssText = [
      'position:fixed',
      'left:50%',
      'bottom:24px',
      'transform:translateX(-50%)',
      'z-index:2147483647',
      'max-width:min(420px,calc(100vw - 32px))',
      'padding:12px 16px',
      'border-radius:12px',
      'font:600 13px/1.35 system-ui,-apple-system,sans-serif',
      `color:${isErr ? '#fecaca' : '#e4e4e7'}`,
      `background:${isErr ? 'rgba(69,10,10,0.94)' : 'rgba(24,24,27,0.94)'}`,
      `border:1px solid ${isErr ? 'rgba(248,113,113,0.45)' : 'rgba(161,161,170,0.35)'}`,
      'box-shadow:0 12px 40px rgba(0,0,0,0.45)',
      'pointer-events:none',
    ].join(';')

    document.documentElement.appendChild(el)
    window.setTimeout(() => {
      try {
        el.remove()
      } catch {
        /* ignore */
      }
    }, 4200)
  } catch {
    /* last resort: avoid throwing from toast */
    console.warn('[PromptBolt]', message)
  }
}
