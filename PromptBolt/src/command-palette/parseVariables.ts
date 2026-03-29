/**
 * @fileoverview Square-bracket placeholder parsing for prompt templates.
 * Used by the command palette variable form before calling {@link injectTextIntoEditableTarget}.
 */

/**
 * Matches one placeholder token: `[Label]` where `Label` cannot contain `]` or newlines.
 * @example `[Name]`, `[Company]`
 */
export const PLACEHOLDER_REGEX = /\[([^\]\r\n]+)\]/g

/**
 * Scans `template` for `[Label]` tokens and returns each unique label in first-seen order.
 *
 * @param template - Raw prompt body, possibly containing repeated placeholders.
 * @returns Ordered unique labels, e.g. `['Name','Company']` for `"Hi [Name] at [Company]"`.
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
 * Substitutes each `[Label]` with `values[Label]`. Missing keys leave the bracket token unchanged.
 *
 * @param template - Original prompt with placeholders.
 * @param values - Map of label → replacement string (often from the variable form).
 * @returns Fully expanded string ready for injection.
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
