/**
 * Variable placeholders use square brackets: `[Name]`, `[Company]`, `[Date]`.
 *
 * Interview note: we scan with a global regex and de-duplicate while preserving
 * first-seen order so the Variable Form matches reading order in the template.
 */

/** Inner capture group is the label between brackets; disallow raw newlines inside a token. */
export const PLACEHOLDER_REGEX = /\[([^\]\r\n]+)\]/g

/**
 * Returns unique placeholder *labels* (trimmed) in left-to-right order of first appearance.
 * Example: `"Hi [Name] from [Company], [Name]"` → `['Name', 'Company']`
 */
export function extractUniquePlaceholders(template: string): string[] {
  PLACEHOLDER_REGEX.lastIndex = 0
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const match of template.matchAll(PLACEHOLDER_REGEX)) {
    const label = match[1].trim()
    if (!label || seen.has(label)) continue
    seen.add(label)
    ordered.push(label)
  }
  return ordered
}

/**
 * Replaces every `[Label]` with `values[Label]`. Unknown labels stay as-is in brackets.
 */
export function applyPlaceholderReplacements(
  template: string,
  values: Record<string, string>,
): string {
  PLACEHOLDER_REGEX.lastIndex = 0
  return template.replace(PLACEHOLDER_REGEX, (_full, inner: string) => {
    const label = String(inner).trim()
    if (Object.prototype.hasOwnProperty.call(values, label)) {
      return values[label]
    }
    return `[${label}]`
  })
}
