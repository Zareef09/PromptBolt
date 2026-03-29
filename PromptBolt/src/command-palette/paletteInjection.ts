import { injectTextIntoEditableTarget } from './injectText'

/** Analytics key (see `storage/analyticsStorage.ts`). */
const PROMPT_INJECTION_COUNT_KEY = 'promptbolt_injection_count' as const

export type InjectionOutcome =
  | { ok: true }
  | { ok: false; error: string }

/**
 * Increments the global “prompts used” counter in `chrome.storage.local`.
 */
export function recordPromptInjection(): void {
  chrome.storage.local.get([PROMPT_INJECTION_COUNT_KEY], (res) => {
    const err = chrome.runtime.lastError
    if (err) return
    const raw = res[PROMPT_INJECTION_COUNT_KEY]
    const n = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0
    chrome.storage.local.set({ [PROMPT_INJECTION_COUNT_KEY]: n + 1 })
  })
}

/**
 * Inserts text into the captured editable target, then records analytics on success.
 *
 * @param text - Final text (after variable substitution when applicable)
 * @returns Whether injection succeeded; on failure, `error` is user-safe
 */
export function injectWithAnalytics(text: string): InjectionOutcome {
  const injected = injectTextIntoEditableTarget(text)
  if (!injected.ok) {
    return { ok: false, error: injected.error }
  }
  recordPromptInjection()
  return { ok: true }
}
