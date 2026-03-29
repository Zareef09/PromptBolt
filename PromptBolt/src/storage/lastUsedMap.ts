/** Maps prompt id → last-used epoch ms (palette ranking). */
export const PROMPT_LAST_USED_KEY = 'promptbolt_last_used' as const

/**
 * Coerces storage JSON into a clean id → timestamp map.
 *
 * @param raw - Value from `chrome.storage.local`
 * @returns Sanitized map; invalid entries are dropped
 */
export function parseLastUsedMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
  }
  return out
}

/**
 * Persists the last-used map to `chrome.storage.local`.
 *
 * @param map - Full map to store (replaces previous value)
 */
export function persistLastUsedMap(map: Record<string, number>): void {
  chrome.storage.local.set({ [PROMPT_LAST_USED_KEY]: map })
}
