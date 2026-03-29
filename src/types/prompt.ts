/**
 * @fileoverview Core domain types for saved prompts and folder organization.
 */

export type Prompt = {
  id: string
  title: string
  content: string
}

export type Folder = {
  id: string
  name: string
  prompts: Prompt[]
}
