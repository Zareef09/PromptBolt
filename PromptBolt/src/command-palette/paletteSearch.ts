import Fuse from 'fuse.js'
import type { PaletteRow } from './types'

/** Sentinel value meaning “all folders” in the palette folder filter. */
export type FolderFilterToken = string

export type GetFilteredPromptsParams = {
  /** Every prompt row (all folders). */
  allRows: PaletteRow[]
  /** Current folder filter (`allFoldersValue` or a folder id). */
  folderFilterId: FolderFilterToken
  /** Value that represents “all folders”. */
  allFoldersValue: string
  /** Raw search query (trimmed inside the function). */
  filterText: string
  /** Prompt id → last used epoch ms; missing ids sort as never used. */
  lastUsedMap: Record<string, number>
}

/**
 * Applies folder scope, fuzzy matching (when the query is non-empty), and ranking:
 * **recency first** (higher `lastUsed` first), then **better Fuse score** as tie-breaker.
 *
 * @param params - Search state
 * @returns Ordered rows ready for the palette list
 */
export function getFilteredPrompts(
  params: GetFilteredPromptsParams,
): PaletteRow[] {
  const { allRows, folderFilterId, allFoldersValue, filterText, lastUsedMap } =
    params

  const scoped: PaletteRow[] =
    folderFilterId === allFoldersValue
      ? [...allRows]
      : allRows.filter((r) => r.folderId === folderFilterId)

  const q = filterText.trim()

  if (!q) {
    return [...scoped].sort((a, b) => {
      const ta = lastUsedMap[a.prompt.id] ?? 0
      const tb = lastUsedMap[b.prompt.id] ?? 0
      return tb - ta
    })
  }

  const fuse = new Fuse(scoped, {
    keys: [
      { name: 'prompt.title', weight: 0.45 },
      { name: 'prompt.content', weight: 0.35 },
      { name: 'folderName', weight: 0.2 },
    ],
    threshold: 0.42,
    ignoreLocation: true,
    includeScore: true,
  })

  const results = fuse.search(q)
  const scoreById = new Map<string, number>()
  for (const hit of results) {
    scoreById.set(hit.item.prompt.id, hit.score ?? 0)
  }

  const matched = results.map((hit) => hit.item)

  return [...matched].sort((a, b) => {
    const ta = lastUsedMap[a.prompt.id] ?? 0
    const tb = lastUsedMap[b.prompt.id] ?? 0
    if (tb !== ta) return tb - ta
    const sa = scoreById.get(a.prompt.id) ?? 1
    const sb = scoreById.get(b.prompt.id) ?? 1
    return sa - sb
  })
}
