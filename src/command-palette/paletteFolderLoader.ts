/**
 * Content-script–only folder loading (duplicates logic from `storage/folderStorage.ts`
 * so the background/content bundle does not share a chunk with the popup — Chrome
 * content scripts must be a single script file).
 */
import type { Folder, Prompt } from '../types/prompt'

const FOLDERS_KEY = 'folders'
const SELECTED_KEY = 'selectedFolderId'
const LEGACY_PROMPTS_KEY = 'prompts'

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function defaultFolder(name = 'Default'): Folder {
  return { id: newId(), name, prompts: [] }
}

function isFolderList(v: unknown): v is Folder[] {
  if (!Array.isArray(v)) return false
  return v.every(
    (f) =>
      f &&
      typeof f === 'object' &&
      typeof (f as Folder).id === 'string' &&
      typeof (f as Folder).name === 'string' &&
      Array.isArray((f as Folder).prompts),
  )
}

/** Inlined from `storage/defaultFolderMigration.ts` for a single-file content bundle. */
function ensureUncategorizedDefaultFolder(
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

function normalize(raw: Record<string, unknown>): {
  folders: Folder[]
  selectedFolderId: string
  keysToRemove: string[]
  defaultFolderMutated: boolean
} {
  const keysToRemove: string[] = []
  let folders: Folder[] = []
  let selectedFolderId = ''
  const rawSelected = raw[SELECTED_KEY]
  if (typeof rawSelected === 'string' && rawSelected.length > 0) {
    selectedFolderId = rawSelected
  }

  const fromFolders = raw[FOLDERS_KEY]
  if (isFolderList(fromFolders)) {
    folders = fromFolders.map((f) => ({
      id: f.id,
      name: f.name,
      prompts: Array.isArray(f.prompts) ? [...f.prompts] : [],
    }))
  } else {
    const legacy = raw[LEGACY_PROMPTS_KEY]
    const general = defaultFolder('Default')
    if (Array.isArray(legacy)) {
      general.prompts = legacy as Prompt[]
      keysToRemove.push(LEGACY_PROMPTS_KEY)
    }
    folders = [general]
    selectedFolderId = general.id
  }

  const ensured = ensureUncategorizedDefaultFolder(folders, newId)
  folders = ensured.folders
  let defaultFolderMutated = ensured.mutated

  if (folders.length === 0) {
    const f = defaultFolder()
    folders = [f]
    selectedFolderId = f.id
    defaultFolderMutated = true
  }

  if (!folders.some((f) => f.id === selectedFolderId)) {
    selectedFolderId = folders[0].id
  }

  return { folders, selectedFolderId, keysToRemove, defaultFolderMutated }
}

/** Same behavior as `loadFolderState` in `storage/folderStorage.ts`. */
export function loadFolderStateForPalette(): Promise<{
  folders: Folder[]
  selectedFolderId: string
}> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(
      [FOLDERS_KEY, LEGACY_PROMPTS_KEY, SELECTED_KEY],
      (res) => {
        const err = chrome.runtime.lastError
        if (err) {
          reject(new Error(err.message))
          return
        }
        const raw = res as Record<string, unknown>
        const normalized = normalize(raw)
        const hasValidFolders = isFolderList(raw[FOLDERS_KEY])
        const needsPersist =
          !hasValidFolders ||
          normalized.keysToRemove.length > 0 ||
          normalized.defaultFolderMutated

        const finish = (): void => {
          resolve({
            folders: normalized.folders,
            selectedFolderId: normalized.selectedFolderId,
          })
        }

        if (!needsPersist) {
          finish()
          return
        }

        const push = (): void => {
          chrome.storage.local.set(
            {
              [FOLDERS_KEY]: normalized.folders,
              [SELECTED_KEY]: normalized.selectedFolderId,
            },
            () => {
              const e2 = chrome.runtime.lastError
              if (e2) reject(new Error(e2.message))
              else finish()
            },
          )
        }

        if (normalized.keysToRemove.length > 0) {
          chrome.storage.local.remove(normalized.keysToRemove, () => {
            const e1 = chrome.runtime.lastError
            if (e1) {
              reject(new Error(e1.message))
              return
            }
            push()
          })
        } else {
          push()
        }
      },
    )
  })
}
