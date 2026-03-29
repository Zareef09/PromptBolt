/**
 * @fileoverview Type definitions for user settings persisted by the extension (Magic AI, etc.).
 */

/**
 * Gemini API credentials for Magic prompt generation (stored in `chrome.storage.local` only).
 */
export type GeminiSettingsV1 = {
  apiKey: string
}
