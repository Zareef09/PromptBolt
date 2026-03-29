/**
 * Content script entry for PromptBolt: mounts the command palette on web pages (⌘⇧K).
 *
 * The heavy lifting is split so behavior is testable and documented:
 * - {@link getFilteredPrompts} — fuzzy search + recency ranking
 * - {@link renderPalette} — shadow DOM markup + glass styles
 * - {@link handlePaletteInjection} — inject text and record usage stats
 *
 * Context-aware ranking: {@link pinRowsForSiteContext} pins folder-named prompts on matching sites.
 *
 * @module content
 */
import { initCommandPalette } from './command-palette/commandPalette'
import {
  folderMatchesSiteContext,
  pinRowsForSiteContext,
} from './command-palette/domainContext'
import { getFilteredPrompts } from './command-palette/paletteSearch'
import {
  renderPaletteSearchShell,
  renderPaletteVariableShell,
  buildVariableFieldsFragment,
} from './command-palette/paletteRender'
import { injectWithAnalytics } from './command-palette/paletteInjection'

export { getFilteredPrompts }
export {
  renderPaletteSearchShell as renderPalette,
  renderPaletteVariableShell,
  buildVariableFieldsFragment,
}
export { injectWithAnalytics as handlePaletteInjection }
export { folderMatchesSiteContext, pinRowsForSiteContext }

try {
  initCommandPalette()
} catch (e) {
  console.warn('[PromptBolt] Content script failed to start', e)
}
