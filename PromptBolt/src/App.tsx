import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import type { Folder, Prompt } from './types/prompt'
import {
  createDefaultFolder,
  createId,
  FOLDERS_STORAGE_KEY,
  loadFolderState,
  SELECTED_FOLDER_STORAGE_KEY,
} from './storage/folderStorage'
import {
  loadInjectionStats,
  minutesSavedFromCount,
  PROMPT_INJECTION_COUNT_KEY,
} from './storage/analyticsStorage'
import {
  parseLastUsedMap,
  persistLastUsedMap,
  PROMPT_LAST_USED_KEY,
} from './storage/lastUsedMap'
import {
  isPromptBoltBackupV1,
  PROMPTBOLT_BACKUP_VERSION,
} from './storage/backupFormat'
import { getStarterPackFolders } from './data/starterPack'
import {
  parseSiteBlacklist,
  persistSiteBlacklist,
  SITE_BLACKLIST_KEY,
} from './storage/siteBlacklist'
import {
  decodePromptSharePayload,
  encodePromptSharePayload,
} from './storage/promptShare'
import {
  loadLlmSettings,
  parseLlmSettings,
  persistLlmSettings,
  type LlmSettingsV1,
  LLM_SETTINGS_KEY,
} from './storage/llmSettingsStorage'
import { generateMagicPrompt } from './magic/magicGenerate'

const PROMPT_DRAG_MIME = 'application/x-promptbolt-prompt-id' as const

type PopupTab = 'library' | 'magic' | 'settings'

export type { Prompt }

function saveFoldersAndSelection(
  folders: Folder[],
  selectedFolderId: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(
      {
        [FOLDERS_STORAGE_KEY]: folders,
        [SELECTED_FOLDER_STORAGE_KEY]: selectedFolderId,
      },
      () => {
        const err = chrome.runtime.lastError
        if (err) reject(new Error(err.message))
        else resolve()
      },
    )
  })
}

export default function App() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string>('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [newFolderName, setNewFolderName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [promptsUsed, setPromptsUsed] = useState(0)
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(
    null,
  )
  const titleInputRef = useRef<HTMLInputElement>(null)
  const addFormRef = useRef<HTMLFormElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  const [popupTab, setPopupTab] = useState<PopupTab>('library')
  const [siteBlacklist, setSiteBlacklist] = useState<string[]>([])
  const [blacklistDraft, setBlacklistDraft] = useState('')
  const [llmSettings, setLlmSettings] = useState<LlmSettingsV1>({
    provider: 'none',
    apiKey: '',
  })
  const [magicGoal, setMagicGoal] = useState('')
  const [magicTitle, setMagicTitle] = useState('')
  const [magicContent, setMagicContent] = useState('')
  const [magicBusy, setMagicBusy] = useState(false)
  const [sharePaste, setSharePaste] = useState('')
  const [shareCopiedId, setShareCopiedId] = useState<string | null>(null)

  const currentFolder = folders.find((f) => f.id === selectedFolderId) ?? folders[0]
  const prompts = currentFolder?.prompts ?? []
  const totalPrompts = folders.reduce((n, f) => n + f.prompts.length, 0)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      const { folders: next, selectedFolderId: sel } = await loadFolderState()
      setFolders(next)
      setSelectedFolderId(sel)
      try {
        const stats = await loadInjectionStats()
        setPromptsUsed(stats.count)
      } catch {
        /* stats are optional for the popup */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    chrome.storage.local.get([SITE_BLACKLIST_KEY, LLM_SETTINGS_KEY], (res) => {
      if (chrome.runtime.lastError) return
      setSiteBlacklist(parseSiteBlacklist(res[SITE_BLACKLIST_KEY]))
      setLlmSettings(parseLlmSettings(res[LLM_SETTINGS_KEY]))
    })
  }, [])

  useEffect(() => {
    type AreaName = Parameters<
      Parameters<typeof chrome.storage.onChanged.addListener>[0]
    >[1]
    const listener = (
      changes: Record<
        string,
        { oldValue?: unknown; newValue?: unknown }
      >,
      areaName: AreaName,
    ) => {
      if (areaName !== 'local') return
      if (changes[FOLDERS_STORAGE_KEY]?.newValue != null) {
        const v = changes[FOLDERS_STORAGE_KEY].newValue
        if (Array.isArray(v)) setFolders(v as Folder[])
      }
      if (changes[SELECTED_FOLDER_STORAGE_KEY]?.newValue != null) {
        const id = changes[SELECTED_FOLDER_STORAGE_KEY].newValue
        if (typeof id === 'string') setSelectedFolderId(id)
      }
      const inj = changes[PROMPT_INJECTION_COUNT_KEY]
      if (inj?.newValue != null) {
        const n = inj.newValue
        if (typeof n === 'number' && Number.isFinite(n)) setPromptsUsed(n)
      }
      if (changes[SITE_BLACKLIST_KEY]?.newValue != null) {
        setSiteBlacklist(parseSiteBlacklist(changes[SITE_BLACKLIST_KEY].newValue))
      }
      if (changes[LLM_SETTINGS_KEY]?.newValue != null) {
        setLlmSettings(parseLlmSettings(changes[LLM_SETTINGS_KEY].newValue))
      }
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  async function persist(nextFolders: Folder[], selectedId: string): Promise<void> {
    await saveFoldersAndSelection(nextFolders, selectedId)
    setFolders(nextFolders)
    setSelectedFolderId(selectedId)
  }

  async function selectFolder(id: string): Promise<void> {
    if (!folders.some((f) => f.id === id)) return
    try {
      await saveFoldersAndSelection(folders, id)
      setSelectedFolderId(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save selection')
    }
  }

  async function handleCreateFolder(): Promise<void> {
    const name = newFolderName.trim()
    if (!name) return
    const folder = createDefaultFolder(name)
    const next = [...folders, folder]
    try {
      await persist(next, folder.id)
      setNewFolderName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create folder')
    }
  }

  async function handleDeleteFolder(folderId: string): Promise<void> {
    if (folders.length <= 1) return
    const victim = folders.find((f) => f.id === folderId)
    if (!victim) return
    const rest = folders.filter((f) => f.id !== folderId)
    const target = rest[0]
    if (!target) return
    const next = rest.map((f) =>
      f.id === target.id
        ? {
            ...f,
            prompts: [...f.prompts, ...victim.prompts],
          }
        : f,
    )
    const sel =
      selectedFolderId === folderId ? target.id : selectedFolderId
    try {
      await persist(next, sel)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete folder')
    }
  }

  async function handleAdd(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    const t = title.trim()
    const c = content.trim()
    if (!t || !c || !currentFolder) return

    const prompt: Prompt = { id: createId(), title: t, content: c }
    const nextFolders = folders.map((f) =>
      f.id === currentFolder.id
        ? { ...f, prompts: [...f.prompts, prompt] }
        : f,
    )
    try {
      await persist(nextFolders, selectedFolderId)
      setTitle('')
      setContent('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  async function handleDeletePrompt(promptId: string): Promise<void> {
    const nextFolders = folders.map((f) => ({
      ...f,
      prompts: f.prompts.filter((p) => p.id !== promptId),
    }))
    try {
      await persist(nextFolders, selectedFolderId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  async function handleMovePrompt(
    promptId: string,
    targetFolderId: string,
  ): Promise<void> {
    const sourceFolder = folders.find((f) =>
      f.prompts.some((x) => x.id === promptId),
    )
    if (!sourceFolder || sourceFolder.id === targetFolderId) return
    let moving: Prompt | undefined
    const without = folders.map((f) => {
      const p = f.prompts.find((x) => x.id === promptId)
      if (p) moving = p
      return {
        ...f,
        prompts: f.prompts.filter((x) => x.id !== promptId),
      }
    })
    if (!moving) return
    const nextFolders = without.map((f) =>
      f.id === targetFolderId
        ? { ...f, prompts: [...f.prompts, moving!] }
        : f,
    )
    try {
      await persist(nextFolders, selectedFolderId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move prompt')
    }
  }

  function focusAddPromptForm(): void {
    addFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    requestAnimationFrame(() => titleInputRef.current?.focus())
  }

  async function handleExportBackup(): Promise<void> {
    try {
      setError(null)
      const lastUsed = await new Promise<Record<string, number>>(
        (resolve, reject) => {
          chrome.storage.local.get([PROMPT_LAST_USED_KEY], (res) => {
            const err = chrome.runtime.lastError
            if (err) reject(new Error(err.message))
            else resolve(parseLastUsedMap(res[PROMPT_LAST_USED_KEY]))
          })
        },
      )
      const payload = {
        version: PROMPTBOLT_BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        folders,
        lastUsed,
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `promptbolt-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.')
    }
  }

  async function handleImportBackupFile(
    e: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      setError(null)
      const text = await file.text()
      const data: unknown = JSON.parse(text)
      if (!isPromptBoltBackupV1(data)) {
        setError('Invalid PromptBolt backup file.')
        return
      }
      if (
        !window.confirm(
          'Replace all folders and prompts with this backup? This cannot be undone.',
        )
      ) {
        return
      }
      const sel = data.folders[0]?.id ?? ''
      await saveFoldersAndSelection(data.folders, sel)
      setFolders(data.folders)
      setSelectedFolderId(sel)
      if (data.lastUsed) {
        persistLastUsedMap(data.lastUsed)
      }
    } catch {
      setError('Could not import backup.')
    }
  }

  async function handleLoadStarterPack(): Promise<void> {
    try {
      setError(null)
      const next = getStarterPackFolders(createId)
      const firstId = next[0]?.id ?? ''
      await persist(next, firstId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load starter pack.')
    }
  }

  function addBlacklistRule(): void {
    const r = blacklistDraft.trim().toLowerCase()
    if (!r) return
    if (siteBlacklist.includes(r)) return
    const next = [...siteBlacklist, r]
    setSiteBlacklist(next)
    persistSiteBlacklist(next)
    setBlacklistDraft('')
  }

  function removeBlacklistRule(rule: string): void {
    const next = siteBlacklist.filter((x) => x !== rule)
    setSiteBlacklist(next)
    persistSiteBlacklist(next)
  }

  function saveLlmSettings(): void {
    persistLlmSettings(llmSettings)
  }

  async function runMagicGenerate(): Promise<void> {
    try {
      setError(null)
      setMagicBusy(true)
      const settings = await loadLlmSettings()
      const out = await generateMagicPrompt(magicGoal, settings)
      setMagicTitle(out.title)
      setMagicContent(out.content)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Magic generation failed.')
    } finally {
      setMagicBusy(false)
    }
  }

  async function addMagicPromptToLibrary(): Promise<void> {
    const t = magicTitle.trim()
    const c = magicContent.trim()
    if (!t || !c || !currentFolder) return
    const prompt: Prompt = { id: createId(), title: t, content: c }
    const nextFolders = folders.map((f) =>
      f.id === currentFolder.id
        ? { ...f, prompts: [...f.prompts, prompt] }
        : f,
    )
    try {
      await persist(nextFolders, selectedFolderId)
      setMagicGoal('')
      setMagicTitle('')
      setMagicContent('')
      setPopupTab('library')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save prompt.')
    }
  }

  function importPortablePrompt(): void {
    const p = decodePromptSharePayload(sharePaste)
    if (!p) {
      setError('Invalid portable prompt code.')
      return
    }
    if (!currentFolder) {
      setError('No folder selected.')
      return
    }
    setError(null)
    const prompt: Prompt = { ...p, id: createId() }
    const nextFolders = folders.map((f) =>
      f.id === currentFolder.id
        ? { ...f, prompts: [...f.prompts, prompt] }
        : f,
    )
    void persist(nextFolders, selectedFolderId).catch((e) => {
      setError(e instanceof Error ? e.message : 'Import failed.')
    })
    setSharePaste('')
  }

  async function copyPortablePrompt(p: Prompt): Promise<void> {
    try {
      const token = encodePromptSharePayload(p)
      await navigator.clipboard.writeText(token)
      setShareCopiedId(p.id)
      window.setTimeout(() => setShareCopiedId(null), 2000)
    } catch {
      setError('Could not copy to clipboard.')
    }
  }

  const minutesSaved = minutesSavedFromCount(promptsUsed)

  const tabBtn = (id: PopupTab, label: string) => (
    <button
      type="button"
      onClick={() => setPopupTab(id)}
      className={`rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wide transition ${
        popupTab === id
          ? 'bg-gradient-to-r from-fuchsia-600/90 to-cyan-600/80 text-white shadow-glow'
          : 'border border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="relative flex min-h-[520px] min-w-[480px] max-w-[640px] overflow-hidden bg-bolt-void">
      <div
        className="pointer-events-none absolute -left-24 -top-20 h-56 w-56 rounded-full bg-fuchsia-600/15 blur-[72px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-16 -right-20 h-52 w-52 rounded-full bg-cyan-500/12 blur-[64px]"
        aria-hidden
      />

      {popupTab === 'library' ? (
      <aside className="relative z-10 flex w-[132px] shrink-0 flex-col border-r border-zinc-800/90 bg-bolt-ink/95 py-3 pl-3 pr-2 backdrop-blur-md">
        <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Folders
        </p>
        <nav className="custom-scrollbar mt-2 max-h-[220px] flex-1 space-y-1 overflow-y-auto pr-1">
          {folders.map((f) => (
            <div key={f.id} className="group flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => void selectFolder(f.id)}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  setDropTargetFolderId(f.id)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  setDropTargetFolderId(null)
                  const id = e.dataTransfer.getData(PROMPT_DRAG_MIME)
                  if (id) void handleMovePrompt(id, f.id)
                }}
                className={`w-full rounded-lg px-2 py-2 text-left text-xs font-medium transition-all duration-200 ${
                  f.id === selectedFolderId
                    ? 'bg-zinc-800 text-zinc-100 ring-1 ring-fuchsia-500/30'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                } ${
                  dropTargetFolderId === f.id
                    ? 'ring-2 ring-cyan-400/60 ring-offset-2 ring-offset-bolt-ink/95 brightness-110'
                    : ''
                }`}
              >
                <span className="line-clamp-2">{f.name}</span>
                <span className="mt-0.5 block text-[10px] font-normal text-zinc-500">
                  {f.prompts.length} prompt{f.prompts.length === 1 ? '' : 's'}
                </span>
              </button>
              {folders.length > 1 ? (
                <button
                  type="button"
                  onClick={() => void handleDeleteFolder(f.id)}
                  className="px-2 text-[10px] text-zinc-600 opacity-0 transition hover:text-rose-400 group-hover:opacity-100"
                  title="Delete folder (prompts move to another folder)"
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}
        </nav>
        <div className="mt-3 space-y-1 border-t border-zinc-800/80 pt-3">
          <input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="New folder"
            className="w-full rounded-lg border border-zinc-800 bg-black/50 px-2 py-1.5 text-[11px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-fuchsia-500/50"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreateFolder()
            }}
          />
          <button
            type="button"
            onClick={() => void handleCreateFolder()}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-1.5 text-[11px] font-medium text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800"
          >
            Add folder
          </button>
        </div>
      </aside>
      ) : null}

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="border-b border-zinc-800/80 bg-bolt-ink/90 px-5 py-4 backdrop-blur-md">
          <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-fuchsia-400/90">
            Prompt
            <span className="text-cyan-400">Bolt</span>
          </p>
          <div
            className="mt-3 rounded-xl border border-zinc-800/80 bg-black/35 px-3 py-2.5 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.5)] ring-1 ring-fuchsia-500/10 backdrop-blur-md transition duration-300"
            aria-live="polite"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
              Stats
            </p>
            <div className="mt-1.5 grid grid-cols-2 gap-2 text-[11px] tabular-nums">
              <div>
                <span className="block text-zinc-500">Prompts used</span>
                <span className="font-semibold text-zinc-200">{promptsUsed}</span>
              </div>
              <div>
                <span className="block text-zinc-500">Time saved</span>
                <span className="font-semibold text-cyan-200/90">
                  {minutesSaved}{' '}
                  {minutesSaved === 1 ? 'minute' : 'minutes'}
                </span>
              </div>
            </div>
          </div>
          <nav
            className="mt-3 flex flex-wrap gap-1.5 rounded-xl border border-zinc-800/80 bg-black/25 p-1.5 ring-1 ring-fuchsia-500/10 backdrop-blur-md"
            aria-label="Popup sections"
          >
            {tabBtn('library', 'Library')}
            {tabBtn('magic', 'Magic')}
            {tabBtn('settings', 'Settings')}
          </nav>

          <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2">
            <span className="text-sm font-medium text-zinc-400">Press</span>
            <kbd className="inline-flex min-h-[2.25rem] min-w-[2.75rem] items-center justify-center rounded-xl border-2 border-fuchsia-400/70 bg-zinc-950 px-3 py-2 font-mono text-base font-bold leading-none text-fuchsia-200 shadow-[0_0_20px_rgba(232,121,249,0.45),0_2px_0_rgba(0,0,0,0.4)_inset]">
              ⌘⇧K
            </kbd>
            <span className="text-sm leading-snug text-zinc-400">
              on any page to open the palette.
            </span>
          </div>
        </header>

        <main className="relative flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {error ? (
            <p className="rounded-2xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
              {error}
            </p>
          ) : null}

          {popupTab === 'library' ? (
          <>
          <p className="text-xs text-zinc-500">
            Editing folder:{' '}
            <span className="font-medium text-zinc-300">
              {currentFolder?.name ?? '—'}
            </span>
          </p>

          <form
            ref={addFormRef}
            onSubmit={(e) => void handleAdd(e)}
            className="space-y-4 rounded-2xl border border-zinc-800 bg-bolt-card/90 p-4 shadow-[0_0_32px_-8px_rgba(232,121,249,0.15)] ring-1 ring-fuchsia-500/10 backdrop-blur-sm transition"
          >
            <div>
              <label
                htmlFor="title"
                className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
              >
                Title
              </label>
              <input
                ref={titleInputRef}
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Anything"
                className="w-full rounded-xl border border-zinc-800 bg-black/60 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-fuchsia-500/60 focus:ring-2 focus:ring-fuchsia-500/25"
              />
            </div>
            <div>
              <label
                htmlFor="content"
                className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
              >
                Content
              </label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Prompt text. Use [Name] for variables."
                rows={4}
                className="w-full resize-none rounded-xl border border-zinc-800 bg-black/60 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/25"
              />
            </div>
            <button
              type="submit"
              className="font-display w-full rounded-xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-cyan-500 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-glow transition hover:brightness-110 active:scale-[0.98]"
            >
              Add prompt
            </button>
          </form>

          <section>
            <h2 className="mb-3 flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest text-zinc-500">
              <span className="text-gen-gradient">Prompts</span>
              <span className="h-px flex-1 bg-gradient-to-r from-zinc-800 to-transparent" />
            </h2>
            {loading ? (
              <p className="text-sm text-zinc-600">Loading…</p>
            ) : prompts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-700/80 bg-zinc-950/55 px-6 py-10 text-center shadow-[0_0_40px_-16px_rgba(34,211,238,0.2)] ring-1 ring-cyan-500/5 backdrop-blur-sm transition duration-300">
                <p className="font-display text-base font-bold text-zinc-300">
                  This folder is lonely
                </p>
                <p className="mt-2 text-sm text-zinc-500">
                  Drop a prompt here from another folder, or add something new.
                </p>
                <button
                  type="button"
                  onClick={focusAddPromptForm}
                  className="font-display mt-5 rounded-xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-cyan-500 px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-white shadow-glow transition hover:brightness-110 active:scale-[0.98]"
                >
                  Add prompt
                </button>
              </div>
            ) : (
              <ul className="custom-scrollbar max-h-56 space-y-2.5 overflow-y-auto pr-1">
                {prompts.map((p) => (
                  <li
                    key={p.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(PROMPT_DRAG_MIME, p.id)
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    onDragEnd={() => setDropTargetFolderId(null)}
                    className="group flex cursor-grab gap-2 rounded-2xl border border-zinc-800/90 bg-zinc-950/70 p-3 transition duration-200 hover:border-fuchsia-500/25 active:cursor-grabbing"
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate font-display text-sm font-bold text-zinc-100"
                        title="Drag into a folder on the left"
                      >
                        {p.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500 group-hover:text-zinc-400">
                        {p.content}
                      </p>
                      <label className="mt-2 block text-[10px] uppercase tracking-wide text-zinc-600">
                        Move to
                        <select
                          value={currentFolder?.id ?? ''}
                          onChange={(e) =>
                            void handleMovePrompt(p.id, e.target.value)
                          }
                          className="ml-2 rounded-md border border-zinc-800 bg-black/50 px-2 py-1 text-[11px] text-zinc-300 outline-none transition hover:border-zinc-700 focus:border-cyan-500/50"
                        >
                          {folders.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1.5 self-start">
                      <button
                        type="button"
                        onClick={() => void copyPortablePrompt(p)}
                        className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide transition ${
                          shareCopiedId === p.id
                            ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                            : 'border-cyan-500/30 bg-cyan-950/25 text-cyan-300 hover:border-cyan-400/45'
                        }`}
                      >
                        {shareCopiedId === p.id ? 'Copied' : 'Share'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeletePrompt(p.id)}
                        className="rounded-lg border border-rose-500/30 bg-rose-950/30 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-rose-400 transition hover:border-rose-400/50 hover:bg-rose-950/60"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          </>
          ) : null}

          {popupTab === 'magic' ? (
            <div className="space-y-4 rounded-2xl border border-zinc-800 bg-bolt-card/90 p-4 shadow-[0_0_32px_-8px_rgba(232,121,249,0.15)] ring-1 ring-violet-500/15 backdrop-blur-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                AI prompt from a goal
              </p>
              <p className="text-xs text-zinc-500">
                Save your API key in Settings. Output uses{' '}
                <span className="font-mono text-emerald-400/90">[Variables]</span>{' '}
                you can fill in the palette.
              </p>
              <textarea
                value={magicGoal}
                onChange={(e) => setMagicGoal(e.target.value)}
                placeholder='e.g. "Write a concise follow-up after a technical interview"'
                rows={4}
                className="w-full resize-none rounded-xl border border-zinc-800 bg-black/60 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
              />
              <button
                type="button"
                disabled={magicBusy}
                onClick={() => void runMagicGenerate()}
                className="font-display w-full rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-glow transition hover:brightness-110 disabled:opacity-50"
              >
                {magicBusy ? 'Generating…' : 'Generate'}
              </button>
              {(magicTitle || magicContent) && (
                <div className="space-y-3 border-t border-zinc-800/80 pt-4">
                  <input
                    value={magicTitle}
                    onChange={(e) => setMagicTitle(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-black/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-500/50"
                    placeholder="Title"
                  />
                  <textarea
                    value={magicContent}
                    onChange={(e) => setMagicContent(e.target.value)}
                    rows={8}
                    className="w-full resize-none rounded-xl border border-zinc-800 bg-black/60 px-3 py-2.5 font-mono text-xs text-zinc-200 outline-none focus:border-cyan-500/50"
                    placeholder="Generated prompt body"
                  />
                  <button
                    type="button"
                    onClick={() => void addMagicPromptToLibrary()}
                    className="w-full rounded-xl border border-emerald-500/35 bg-emerald-950/30 py-2.5 text-xs font-bold uppercase tracking-wide text-emerald-200 transition hover:bg-emerald-950/45"
                  >
                    Add to current folder
                  </button>
                </div>
              )}
            </div>
          ) : null}

          {popupTab === 'settings' ? (
            <div className="space-y-5">
              <section className="rounded-2xl border border-zinc-800 bg-black/35 p-4 ring-1 ring-cyan-500/10 backdrop-blur-md">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                  Portable library (JSON)
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleExportBackup()}
                    className="rounded-lg border border-zinc-700 bg-zinc-900/90 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 transition hover:border-zinc-600"
                  >
                    Export JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => importInputRef.current?.click()}
                    className="rounded-lg border border-zinc-700 bg-zinc-900/90 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 transition hover:border-zinc-600"
                  >
                    Import JSON
                  </button>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(ev) => void handleImportBackupFile(ev)}
                  />
                </div>
                {!loading && totalPrompts === 0 ? (
                  <button
                    type="button"
                    onClick={() => void handleLoadStarterPack()}
                    className="mt-3 w-full rounded-lg border border-cyan-500/35 bg-cyan-950/30 py-2 text-[11px] font-bold uppercase tracking-wide text-cyan-200 transition hover:border-cyan-400/50"
                  >
                    Load starter pack
                  </button>
                ) : null}
              </section>

              <section className="rounded-2xl border border-zinc-800 bg-black/35 p-4 ring-1 ring-fuchsia-500/10 backdrop-blur-md">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                  Portable single prompt
                </p>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Paste a code a teammate shared. Adds to the folder selected on
                  the Library tab.
                </p>
                <textarea
                  value={sharePaste}
                  onChange={(e) => setSharePaste(e.target.value)}
                  placeholder="Paste base64 share token…"
                  rows={3}
                  className="mt-2 w-full resize-none rounded-xl border border-zinc-800 bg-black/50 px-3 py-2 font-mono text-[11px] text-zinc-300 outline-none focus:border-fuchsia-500/40"
                />
                <button
                  type="button"
                  onClick={importPortablePrompt}
                  className="mt-2 w-full rounded-xl border border-fuchsia-500/35 bg-fuchsia-950/25 py-2 text-[11px] font-bold uppercase tracking-wide text-fuchsia-200 transition hover:bg-fuchsia-950/40"
                >
                  Import portable prompt
                </button>
              </section>

              <section className="rounded-2xl border border-zinc-800 bg-black/35 p-4 ring-1 ring-violet-500/10 backdrop-blur-md">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                  Magic — API key
                </p>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Keys stay in{' '}
                  <span className="text-zinc-400">chrome.storage.local</span>{' '}
                  only (never embedded in code).
                </p>
                <select
                  value={llmSettings.provider}
                  onChange={(e) =>
                    setLlmSettings((s) => ({
                      ...s,
                      provider: e.target.value as LlmSettingsV1['provider'],
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-zinc-800 bg-black/60 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-violet-500/45"
                >
                  <option value="none">Disabled</option>
                  <option value="gemini">Google Gemini (AI Studio key)</option>
                  <option value="openai">OpenAI API</option>
                </select>
                <input
                  type="password"
                  autoComplete="off"
                  value={llmSettings.apiKey}
                  onChange={(e) =>
                    setLlmSettings((s) => ({ ...s, apiKey: e.target.value }))
                  }
                  placeholder="API key"
                  className="mt-2 w-full rounded-xl border border-zinc-800 bg-black/60 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-violet-500/45"
                />
                <button
                  type="button"
                  onClick={saveLlmSettings}
                  className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2 text-[11px] font-semibold text-zinc-200 transition hover:border-zinc-600"
                >
                  Save key
                </button>
              </section>

              <section className="rounded-2xl border border-zinc-800 bg-black/35 p-4 ring-1 ring-rose-500/15 backdrop-blur-md">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                  Site blacklist
                </p>
                <p className="mt-1 text-[11px] text-zinc-500">
                  PromptBolt won&apos;t open on these hosts. Use{' '}
                  <span className="font-mono text-zinc-400">bank.com</span> or{' '}
                  <span className="font-mono text-zinc-400">*.bank.com</span>.
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    value={blacklistDraft}
                    onChange={(e) => setBlacklistDraft(e.target.value)}
                    placeholder="e.g. chase.com"
                    className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-black/60 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-rose-500/35"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addBlacklistRule()
                    }}
                  />
                  <button
                    type="button"
                    onClick={addBlacklistRule}
                    className="shrink-0 rounded-xl border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-[11px] font-bold uppercase text-rose-200 transition hover:bg-rose-950/45"
                  >
                    Add
                  </button>
                </div>
                <ul className="mt-3 max-h-28 space-y-1 overflow-y-auto custom-scrollbar text-[11px] text-zinc-400">
                  {siteBlacklist.length === 0 ? (
                    <li className="text-zinc-600">No blocked sites.</li>
                  ) : (
                    siteBlacklist.map((rule) => (
                      <li
                        key={rule}
                        className="flex items-center justify-between gap-2 rounded-lg bg-zinc-950/50 px-2 py-1"
                      >
                        <span className="font-mono text-zinc-300">{rule}</span>
                        <button
                          type="button"
                          onClick={() => removeBlacklistRule(rule)}
                          className="text-rose-400 hover:text-rose-300"
                        >
                          Remove
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </section>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  )
}
