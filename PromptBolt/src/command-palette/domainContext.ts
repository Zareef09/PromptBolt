import type { PaletteRow } from './types'

/**
 * Strips non-alphanumeric characters for fuzzy name ↔ host matching.
 *
 * @param s - Folder name or host segment
 */
function normalizeToken(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Host-specific tokens plus curated aliases (Gmail, ChatGPT, etc.).
 *
 * @param hostname - `window.location.hostname`
 */
export function hostnameContextTokens(hostname: string): string[] {
  const host = hostname.replace(/^www\./, '').toLowerCase()
  const parts = host.split('.').filter(Boolean)
  const skip = new Set(['com', 'org', 'net', 'io', 'co', 'ai', 'app', 'dev', 'www'])
  const keys = new Set<string>()
  for (const p of parts) {
    if (!skip.has(p)) keys.add(normalizeToken(p))
  }

  const aliases: Record<string, string[]> = {
    'openai.com': ['openai', 'chatgpt', 'gpt'],
    'chatgpt.com': ['chatgpt', 'openai', 'gpt'],
    'linkedin.com': ['linkedin'],
    'google.com': ['google', 'gmail'],
    'mail.google.com': ['gmail', 'google', 'mail'],
    'chat.openai.com': ['chatgpt', 'openai', 'gpt'],
  }

  for (const a of aliases[host] ?? []) keys.add(normalizeToken(a))
  return [...keys].filter((k) => k.length >= 2)
}

/**
 * Whether a folder label should be treated as “for this site” (pins its prompts).
 *
 * @param folderName - Folder display name
 * @param hostname - Current page hostname
 */
export function folderMatchesSiteContext(
  folderName: string,
  hostname: string,
): boolean {
  if (!hostname.trim() || !folderName.trim()) return false
  const fn = normalizeToken(folderName)
  if (fn.length < 2) return false
  for (const t of hostnameContextTokens(hostname)) {
    if (fn.includes(t) || t.includes(fn)) return true
  }
  return false
}

/**
 * Moves rows whose folder matches the current site to the front (stable within each group).
 *
 * @param rows - Already sorted by fuzzy + recency
 * @param hostname - `location.hostname` from the content script
 */
export function pinRowsForSiteContext(
  rows: PaletteRow[],
  hostname: string,
): PaletteRow[] {
  if (!hostname.trim()) return rows
  const pinned: PaletteRow[] = []
  const rest: PaletteRow[] = []
  for (const r of rows) {
    if (folderMatchesSiteContext(r.folderName, hostname)) pinned.push(r)
    else rest.push(r)
  }
  return [...pinned, ...rest]
}
