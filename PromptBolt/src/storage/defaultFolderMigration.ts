import type { Folder } from '../types/prompt'

/**
 * Ensures a "Default" folder exists for uncategorized prompts:
 * renames legacy "General" if present, otherwise prepends an empty Default folder.
 */
export function ensureUncategorizedDefaultFolder(
  folders: Folder[],
  createId: () => string,
): { folders: Folder[]; mutated: boolean } {
  if (folders.some((f) => f.name === 'Default')) {
    return { folders, mutated: false }
  }
  const generalIdx = folders.findIndex((f) => f.name === 'General')
  if (generalIdx >= 0) {
    return {
      folders: folders.map((f, i) =>
        i === generalIdx ? { ...f, name: 'Default' } : f,
      ),
      mutated: true,
    }
  }
  return {
    folders: [{ id: createId(), name: 'Default', prompts: [] }, ...folders],
    mutated: true,
  }
}
