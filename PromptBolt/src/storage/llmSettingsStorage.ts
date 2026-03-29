/**
 * @fileoverview Loads and persists Gemini API settings for Magic generation in `chrome.storage.local`.
 */

import type { GeminiSettingsV1 } from '@bolt-types/settings'

/** Same storage key as legacy builds; value shape may omit `provider` (Gemini-only). */
export const GEMINI_SETTINGS_STORAGE_KEY = 'promptbolt_llm_settings' as const

/** @deprecated Use {@link GEMINI_SETTINGS_STORAGE_KEY} */
export const LLM_SETTINGS_KEY = GEMINI_SETTINGS_STORAGE_KEY

const defaultSettings: GeminiSettingsV1 = {
  apiKey: '',
}

/**
 * Parses stored Magic settings, including migration from legacy `{ provider, apiKey }` objects.
 *
 * @param raw - Value from `chrome.storage.local`
 */
export function parseGeminiSettings(raw: unknown): GeminiSettingsV1 {
  if (!raw || typeof raw !== 'object') return { ...defaultSettings }
  const o = raw as Record<string, unknown>
  if (typeof o.apiKey === 'string' && !('provider' in o)) {
    return { apiKey: o.apiKey }
  }
  const provider = o.provider
  const apiKey = o.apiKey
  if (provider === 'gemini' && typeof apiKey === 'string') {
    return { apiKey }
  }
  return { ...defaultSettings }
}

export function persistGeminiSettings(settings: GeminiSettingsV1): void {
  chrome.storage.local.set({ [GEMINI_SETTINGS_STORAGE_KEY]: settings })
}

export function loadGeminiSettings(): Promise<GeminiSettingsV1> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([GEMINI_SETTINGS_STORAGE_KEY], (res) => {
      const err = chrome.runtime.lastError
      if (err) reject(new Error(err.message))
      else resolve(parseGeminiSettings(res[GEMINI_SETTINGS_STORAGE_KEY]))
    })
  })
}

/** @deprecated Use {@link parseGeminiSettings} */
export const parseLlmSettings = parseGeminiSettings

/** @deprecated Use {@link persistGeminiSettings} */
export const persistLlmSettings = persistGeminiSettings

/** @deprecated Use {@link loadGeminiSettings} */
export const loadLlmSettings = loadGeminiSettings
