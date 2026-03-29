/**
 * @fileoverview Parses model output into a structured prompt (title + body) for the library.
 */

export type MagicGenerationResult = {
  title: string
  content: string
}

/**
 * Extracts a JSON object with `title` / `content` from model output (best-effort).
 *
 * @param text - Raw model response
 */
export function extractMagicTemplateJson(
  text: string,
): MagicGenerationResult | null {
  const t = text.trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    const obj = JSON.parse(t.slice(start, end + 1)) as unknown
    if (!obj || typeof obj !== 'object') return null
    const o = obj as Record<string, unknown>
    const title = o.title
    const content = o.content
    if (typeof title !== 'string' || typeof content !== 'string') return null
    if (!title.trim() || !content.trim()) return null
    return { title: title.trim(), content: content.trim() }
  } catch {
    return null
  }
}
