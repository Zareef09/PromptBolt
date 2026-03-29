/** Total successful prompt insertions from the command palette (content script). */
export const PROMPT_INJECTION_COUNT_KEY = 'promptbolt_injection_count' as const

export type InjectionStats = {
  count: number
}

export function loadInjectionStats(): Promise<InjectionStats> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([PROMPT_INJECTION_COUNT_KEY], (res) => {
      const err = chrome.runtime.lastError
      if (err) {
        reject(new Error(err.message))
        return
      }
      const raw = res[PROMPT_INJECTION_COUNT_KEY]
      const count = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0
      resolve({ count })
    })
  })
}

/** Called from the content script after a successful palette injection. */
export function incrementPromptInjectionCount(): void {
  chrome.storage.local.get([PROMPT_INJECTION_COUNT_KEY], (res) => {
    const err = chrome.runtime.lastError
    if (err) return
    const raw = res[PROMPT_INJECTION_COUNT_KEY]
    const n = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0
    chrome.storage.local.set({ [PROMPT_INJECTION_COUNT_KEY]: n + 1 })
  })
}

/** 30 seconds saved per injection (product assumption for the popup stats line). */
export const SECONDS_SAVED_PER_INJECTION = 30

export function minutesSavedFromCount(count: number): number {
  if (count <= 0) return 0
  return Math.max(1, Math.round((count * SECONDS_SAVED_PER_INJECTION) / 60))
}
