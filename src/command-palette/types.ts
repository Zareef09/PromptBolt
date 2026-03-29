import type { Prompt } from '../types/prompt'

export type { Prompt, Folder } from '../types/prompt'

export type PaletteMode = 'search' | 'variables'

/** One selectable row in the palette (prompt plus its folder for display/filter). */
export type PaletteRow = {
  folderId: string
  folderName: string
  prompt: Prompt
}
