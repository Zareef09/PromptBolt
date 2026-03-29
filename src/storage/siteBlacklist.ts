/** User-defined hostnames / patterns where PromptBolt is disabled. */
export const SITE_BLACKLIST_KEY = 'promptbolt_site_blacklist' as const

/**
 * @param raw - Value from chrome.storage
 */
export function parseSiteBlacklist(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
}

/**
 * @param rules - Host rules (`bank.com` exact, `*.bank.com` subdomain wildcard)
 */
export function persistSiteBlacklist(rules: string[]): void {
  chrome.storage.local.set({ [SITE_BLACKLIST_KEY]: rules })
}

/**
 * @param hostname - Current page host, lowercased recommended
 * @param rules - Stored blacklist entries
 */
export function hostnameMatchesSiteBlacklist(
  hostname: string,
  rules: string[],
): boolean {
  const host = hostname.replace(/^www\./, '').toLowerCase()
  for (let rule of rules) {
    rule = rule.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0] ?? ''
    if (!rule) continue
    if (rule.startsWith('*.')) {
      const suff = rule.slice(2)
      if (host === suff || host.endsWith(`.${suff}`)) return true
      continue
    }
    if (host === rule) return true
  }
  return false
}
