import type { Folder, Prompt } from '../types/prompt'

/**
 * Ready-made folders + prompts for first-time users (empty library).
 *
 * @param createId - Id factory (must match app storage ids)
 * @returns New folder tree to merge or replace
 */
export function getStarterPackFolders(createId: () => string): Folder[] {
  const networking: Prompt[] = [
    {
      id: createId(),
      title: 'LinkedIn connection note',
      content:
        'Hi [Name], I enjoyed your post on [Topic]. I’m building in [Space] and would love to connect and swap notes.',
    },
    {
      id: createId(),
      title: 'Cold email — value first',
      content:
        'Hi [Name],\n\nI noticed [Company] is [Observation]. We help teams [Outcome] — happy to share a 1-page overview if useful.\n\nBest,\n[Your Name]',
    },
  ]

  const ai: Prompt[] = [
    {
      id: createId(),
      title: 'Code review assistant',
      content:
        'You are a senior engineer. Review this [Language] code for correctness, edge cases, security, and readability. Suggest concrete improvements.\n\n```\n[Code]\n```',
    },
    {
      id: createId(),
      title: 'Debug systematically',
      content:
        'Context: [Problem]. Stack: [Stack]. Steps to reproduce: [Steps]. What I tried: [Attempts]. Ask clarifying questions, then propose the smallest fix.',
    },
  ]

  const support: Prompt[] = [
    {
      id: createId(),
      title: 'Empathetic ticket reply',
      content:
        'Hi [Name],\n\nThanks for reaching out — I’m sorry you’re running into [Issue]. Here’s what I’ll do next: [Plan]. I’ll update you by [Timeframe].\n\nThanks for your patience,\n[Agent Name]',
    },
    {
      id: createId(),
      title: 'Bug report to engineering',
      content:
        'Summary: [One line]\nSeverity: [S1–S4]\nEnvironment: [Browser/OS]\nRepro: [Steps]\nExpected: [X] Actual: [Y]\nLogs: [Link or snippet]',
    },
  ]

  return [
    { id: createId(), name: 'Networking', prompts: networking },
    { id: createId(), name: 'AI Engineering', prompts: ai },
    { id: createId(), name: 'Support', prompts: support },
  ]
}
