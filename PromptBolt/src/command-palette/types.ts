export type Prompt = {
  id: string
  title: string
  content: string
}

export const PROMPTS_STORAGE_KEY = 'prompts'

export type PaletteMode = 'search' | 'variables'
