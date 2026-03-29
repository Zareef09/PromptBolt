import type { Folder } from '../types/prompt'

export const PROMPTBOLT_BACKUP_VERSION = 1 as const

/** Serialized library for export/import. */
export type PromptBoltBackupV1 = {
  version: typeof PROMPTBOLT_BACKUP_VERSION
  exportedAt: string
  folders: Folder[]
  /** Optional: prompt id → last used ms */
  lastUsed?: Record<string, number>
}

/**
 * Type guard for backup JSON (loose validation).
 *
 * @param data - Parsed JSON
 * @returns Whether `data` looks like a v1 backup
 */
export function isPromptBoltBackupV1(data: unknown): data is PromptBoltBackupV1 {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (d.version !== 1) return false
  if (typeof d.exportedAt !== 'string') return false
  if (!Array.isArray(d.folders)) return false
  return d.folders.every(
    (f) =>
      f &&
      typeof f === 'object' &&
      typeof (f as Folder).id === 'string' &&
      typeof (f as Folder).name === 'string' &&
      Array.isArray((f as Folder).prompts),
  )
}
