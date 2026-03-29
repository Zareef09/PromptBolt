export const LLM_SETTINGS_KEY = 'promptbolt_llm_settings' as const

export type LlmProvider = 'none' | 'gemini' | 'openai'

export type LlmSettingsV1 = {
  provider: LlmProvider
  /** User API key — stored only in chrome.storage.local */
  apiKey: string
}

const defaultSettings: LlmSettingsV1 = {
  provider: 'none',
  apiKey: '',
}

/**
 * @param raw - chrome.storage value
 */
export function parseLlmSettings(raw: unknown): LlmSettingsV1 {
  if (!raw || typeof raw !== 'object') return { ...defaultSettings }
  const o = raw as Record<string, unknown>
  const provider = o.provider
  const apiKey = o.apiKey
  const p: LlmProvider =
    provider === 'gemini' || provider === 'openai' || provider === 'none'
      ? provider
      : 'none'
  return {
    provider: p,
    apiKey: typeof apiKey === 'string' ? apiKey : '',
  }
}

export function persistLlmSettings(settings: LlmSettingsV1): void {
  chrome.storage.local.set({ [LLM_SETTINGS_KEY]: settings })
}

export function loadLlmSettings(): Promise<LlmSettingsV1> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([LLM_SETTINGS_KEY], (res) => {
      const err = chrome.runtime.lastError
      if (err) reject(new Error(err.message))
      else resolve(parseLlmSettings(res[LLM_SETTINGS_KEY]))
    })
  })
}
