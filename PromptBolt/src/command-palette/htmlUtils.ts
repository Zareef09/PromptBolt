export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Wraps `[placeholder]` tokens in a monospace span (call **after** {@link escapeHtml}).
 *
 * @param escaped - HTML-escaped plain text
 * @returns Safe HTML string with `.ph-mono` spans
 */
export function wrapBracketPlaceholdersForPreview(escaped: string): string {
  return escaped.replace(
    /(\[[^\]]+\])/g,
    '<span class="ph-mono">$1</span>',
  )
}
