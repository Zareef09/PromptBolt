/**
 * @fileoverview Folder CRUD and migration for `chrome.storage.local` (`folders`, `selectedFolderId`).
 */

import type { Folder, Prompt } from '../types/prompt'
import { ensureUncategorizedDefaultFolder } from './defaultFolderMigration'

export const FOLDERS_STORAGE_KEY = 'folders'
export const SELECTED_FOLDER_STORAGE_KEY = 'selectedFolderId'
/** @deprecated Legacy flat list; migrated into a single folder. */
export const LEGACY_PROMPTS_STORAGE_KEY = 'prompts'

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function createDefaultFolder(name = 'Default'): Folder {
  return { id: createId(), name, prompts: [] }
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

/**
 * Normalizes storage: migrates legacy `prompts` array into `folders`, ensures at least one folder.
 */
export function normalizeFolderData(raw: Record<string, unknown>): {
  folders: Folder[]
  selectedFolderId: string
  /** Keys to clear after migration */
  keysToRemove: string[]
  /** True when "Default" folder was added or General→Default rename was applied. */
  defaultFolderMutated: boolean
} {
  const keysToRemove: string[] = []
  let folders: Folder[] = []
  let selectedFolderId = ''
  const rawSelected = raw[SELECTED_FOLDER_STORAGE_KEY]
  if (typeof rawSelected === 'string' && rawSelected.length > 0) {
    selectedFolderId = rawSelected
  }

  const fromFolders = raw[FOLDERS_STORAGE_KEY]
  if (isFolderList(fromFolders)) {
    folders = fromFolders.map((f) => ({
      id: f.id,
      name: f.name,
      prompts: Array.isArray(f.prompts) ? [...f.prompts] : [],
    }))
  } else {
    const legacy = raw[LEGACY_PROMPTS_STORAGE_KEY]
    const general = createDefaultFolder('Default')
    if (Array.isArray(legacy)) {
      general.prompts = legacy as Prompt[]
      keysToRemove.push(LEGACY_PROMPTS_STORAGE_KEY)
    }
    folders = [general]
    selectedFolderId = general.id
  }

  const ensured = ensureUncategorizedDefaultFolder(folders, createId)
  folders = ensured.folders
  let defaultFolderMutated = ensured.mutated

  if (folders.length === 0) {
    const f = createDefaultFolder()
    folders = [f]
    selectedFolderId = f.id
    defaultFolderMutated = true
  }

  if (!folders.some((f) => f.id === selectedFolderId)) {
    selectedFolderId = folders[0].id
  }

  return { folders, selectedFolderId, keysToRemove, defaultFolderMutated }
}

/**
 * Loads folders from storage, persists first-time migration from legacy `prompts` if needed.
 */
export function loadFolderState(): Promise<{
  folders: Folder[]
  selectedFolderId: string
}> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(
      [
        FOLDERS_STORAGE_KEY,
        LEGACY_PROMPTS_STORAGE_KEY,
        SELECTED_FOLDER_STORAGE_KEY,
      ],
      (res) => {
        const err = chrome.runtime.lastError
        if (err) {
          reject(new Error(err.message))
          return
        }
        const raw = res as Record<string, unknown>
        const normalized = normalizeFolderData(raw)
        const hasValidFolders = isFolderList(raw[FOLDERS_STORAGE_KEY])
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

        const afterRemove = (): void => {
          chrome.storage.local.set(
            {
              [FOLDERS_STORAGE_KEY]: normalized.folders,
              [SELECTED_FOLDER_STORAGE_KEY]: normalized.selectedFolderId,
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
            afterRemove()
          })
        } else {
          afterRemove()
        }
      },
    )
  })
}

export { createId }
