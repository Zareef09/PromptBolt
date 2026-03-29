/**
 * @fileoverview Google Gemini 1.5 Flash integration for the Magic “Prompt Architect” flow.
 */

import { extractMagicTemplateJson, type MagicGenerationResult } from './magicTemplateParse'

export type { MagicGenerationResult }

const GEMINI_15_FLASH_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

/** Wall-clock limit for a single generateContent request (network + model). */
const REQUEST_TIMEOUT_MS = 90_000

/**
 * Instruction block: JSON-only output with square-bracket variables for the palette/injection engine.
 */
const PROMPT_ARCHITECT_INSTRUCTION = `You are an expert Prompt Architect. Produce reusable prompt templates for copy-paste workflows.

Rules:
- Return ONLY valid JSON with keys "title" (short label) and "content" (full template text).
- In "content", use square-bracket placeholders like [Name], [Company], [Topic], [Date] wherever the user should fill in details. Use clear, human-readable labels inside the brackets.
- Templates must work with search and variable substitution that expects [Label] tokens.
- No markdown code fences, no commentary outside the JSON object.`

function mapGeminiHttpError(status: number, bodySnippet: string): string {
  if (status === 400) {
    return 'The request was rejected. Check that your goal text is valid, then try again.'
  }
  if (status === 401 || status === 403) {
    return 'API key was rejected. Open Settings and verify your Gemini API key (Google AI Studio).'
  }
  if (status === 404) {
    return 'Gemini model endpoint was not found. Update PromptBolt or check Google AI documentation.'
  }
  if (status === 429) {
    return 'Rate limit reached. Wait a moment and try again.'
  }
  if (status >= 500) {
    return 'Gemini is temporarily unavailable. Try again in a few minutes.'
  }
  const hint = bodySnippet.trim().slice(0, 160)
  return hint ? `Request failed (${status}). ${hint}` : `Request failed (${status}).`
}

/**
 * Calls Gemini 1.5 Flash `generateContent` and returns a title/body pair for the prompt library.
 *
 * @param goal - User’s natural-language goal
 * @param apiKey - Gemini API key (Google AI Studio)
 */
export async function generateMagicPrompt(
  goal: string,
  apiKey: string,
): Promise<MagicGenerationResult> {
  const g = goal.trim()
  if (!g) {
    throw new Error('Describe what you want the prompt to do.')
  }
  const key = apiKey.trim()
  if (!key) {
    throw new Error('Add your Gemini API key in Settings to use Magic.')
  }

  const url = `${GEMINI_15_FLASH_ENDPOINT}?key=${encodeURIComponent(key)}`
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `${PROMPT_ARCHITECT_INSTRUCTION}\n\nUser goal:\n${g}`,
              },
            ],
          },
        ],
      }),
    })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(
        'The request took too long (timeout). Check your connection and try again.',
      )
    }
    throw new Error(
      'Network error while calling Gemini. Check your connection and try again.',
    )
  } finally {
    window.clearTimeout(timer)
  }

  const errText = await res.text().catch(() => '')

  if (!res.ok) {
    let snippet = errText
    try {
      const parsed = JSON.parse(errText) as {
        error?: { message?: string; status?: string }
      }
      if (parsed.error?.message) snippet = parsed.error.message
    } catch {
      /* use raw text */
    }
    throw new Error(mapGeminiHttpError(res.status, snippet))
  }

  let data: {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  try {
    data = JSON.parse(errText) as typeof data
  } catch {
    throw new Error('Could not read Gemini response. Try again.')
  }

  const text =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ??
    ''
  if (!text.trim()) {
    throw new Error(
      'Gemini returned an empty response. Rephrase your goal and try again.',
    )
  }

  const parsed = extractMagicTemplateJson(text)
  if (!parsed) {
    throw new Error(
      'Could not parse the model response. Try generating again with a clearer goal.',
    )
  }
  return parsed
}
