import type { Prompt } from '../types/prompt'

export const PROMPT_SHARE_VERSION = 1 as const

export type PromptSharePayload = {
  v: typeof PROMPT_SHARE_VERSION
  prompt: Prompt
}

/**
 * Creates a portable base64 string a teammate can paste to import one prompt.
 *
 * @param prompt - Prompt to share (ids are preserved; importer may regenerate)
 */
export function encodePromptSharePayload(prompt: Prompt): string {
  const payload: PromptSharePayload = { v: PROMPT_SHARE_VERSION, prompt }
  const json = JSON.stringify(payload)
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary)
}

/**
 * Parses a share string from {@link encodePromptSharePayload}.
 *
 * @param encoded - Base64 (UTF-8) payload
 * @returns Parsed prompt or `null` if invalid
 */
export function decodePromptSharePayload(encoded: string): Prompt | null {
  try {
    const trimmed = encoded.trim()
    if (!trimmed) return null
    const binary = atob(trimmed)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const json = new TextDecoder().decode(bytes)
    const data = JSON.parse(json) as unknown
    if (!data || typeof data !== 'object') return null
    const d = data as Record<string, unknown>
    if (d.v !== PROMPT_SHARE_VERSION) return null
    const p = d.prompt
    if (!p || typeof p !== 'object') return null
    const pr = p as Record<string, unknown>
    if (
      typeof pr.id !== 'string' ||
      typeof pr.title !== 'string' ||
      typeof pr.content !== 'string'
    ) {
      return null
    }
    return { id: pr.id, title: pr.title, content: pr.content }
  } catch {
    return null
  }
}
