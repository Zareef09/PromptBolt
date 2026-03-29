import type { LlmSettingsV1 } from '../storage/llmSettingsStorage'

export type MagicGenerationResult = {
  title: string
  content: string
}

/**
 * Extracts a JSON object with title/content from model output (best-effort).
 *
 * @param text - Raw model response
 */
function extractJsonPrompt(text: string): MagicGenerationResult | null {
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

/** System-style instruction sent to the model (no secrets). */
const MAGIC_INSTRUCTION = `You write reusable text templates. Return ONLY valid JSON with keys "title" (short label) and "content" (the full template). Use square-bracket placeholders like [Name], [Company], [Topic] where personalization helps. No markdown fences, no commentary.`

/**
 * Calls Gemini (Google AI Studio) generateContent.
 *
 * @param goal - User’s natural-language goal
 * @param apiKey - Gemini API key
 */
async function generateWithGemini(
  goal: string,
  apiKey: string,
): Promise<MagicGenerationResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: `${MAGIC_INSTRUCTION}\n\nUser goal: ${goal}` },
          ],
        },
      ],
    }),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(
      `Gemini request failed (${res.status}). ${errText.slice(0, 120)}`,
    )
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  const text =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ??
    ''
  const parsed = extractJsonPrompt(text)
  if (!parsed) throw new Error('Could not parse model response as JSON.')
  return parsed
}

/**
 * Calls OpenAI chat completions.
 *
 * @param goal - User’s natural-language goal
 * @param apiKey - OpenAI API key
 */
async function generateWithOpenAI(
  goal: string,
  apiKey: string,
): Promise<MagicGenerationResult> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: MAGIC_INSTRUCTION },
        { role: 'user', content: goal },
      ],
      temperature: 0.7,
    }),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(
      `OpenAI request failed (${res.status}). ${errText.slice(0, 120)}`,
    )
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const text = data.choices?.[0]?.message?.content ?? ''
  const parsed = extractJsonPrompt(text)
  if (!parsed) throw new Error('Could not parse model response as JSON.')
  return parsed
}

/**
 * Runs Magic generation using whichever provider the user configured.
 *
 * @param goal - Free-text goal from the Magic tab
 * @param settings - Provider + API key from `chrome.storage.local` only
 */
export async function generateMagicPrompt(
  goal: string,
  settings: LlmSettingsV1,
): Promise<MagicGenerationResult> {
  const g = goal.trim()
  if (!g) throw new Error('Describe what you want the prompt to do.')
  if (settings.provider === 'none' || !settings.apiKey.trim()) {
    throw new Error(
      'Choose a provider and save an API key in Settings → Magic & privacy.',
    )
  }
  if (settings.provider === 'gemini') {
    return generateWithGemini(g, settings.apiKey.trim())
  }
  return generateWithOpenAI(g, settings.apiKey.trim())
}
