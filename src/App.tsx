/**
 * @fileoverview Root React app for the extension popup: library state, Magic AI, and settings.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import type { Folder, Prompt } from '@bolt-types/prompt'
import type { PopupTab } from '@components/popup/types'
import { PopupHeader } from '@components/popup/PopupHeader'
import { FolderSidebar } from '@components/library/FolderSidebar'
import { LibraryTab } from '@components/library/LibraryTab'
import { MagicTab } from '@components/magic/MagicTab'
import { SettingsTab } from '@components/settings/SettingsTab'
import {
  createDefaultFolder,
  createId,
  FOLDERS_STORAGE_KEY,
  loadFolderState,
  SELECTED_FOLDER_STORAGE_KEY,
} from '@storage/folderStorage'
import {
  loadInjectionStats,
  minutesSavedFromCount,
  PROMPT_INJECTION_COUNT_KEY,
} from '@storage/analyticsStorage'
import {
  parseLastUsedMap,
  persistLastUsedMap,
  PROMPT_LAST_USED_KEY,
} from '@storage/lastUsedMap'
import {
  isPromptBoltBackupV1,
  PROMPTBOLT_BACKUP_VERSION,
} from '@storage/backupFormat'
import { getStarterPackFolders } from '@data/starterPack'
import {
  parseSiteBlacklist,
  persistSiteBlacklist,
  SITE_BLACKLIST_KEY,
} from '@storage/siteBlacklist'
import {
  decodePromptSharePayload,
  encodePromptSharePayload,
} from '@storage/promptShare'
import {
  loadGeminiSettings,
  parseGeminiSettings,
  persistGeminiSettings,
  GEMINI_SETTINGS_STORAGE_KEY,
} from '@storage/llmSettingsStorage'
import type { GeminiSettingsV1 } from '@bolt-types/settings'
import { generateMagicPrompt } from '@services/geminiMagic'

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
  const [geminiSettings, setGeminiSettings] = useState<GeminiSettingsV1>({
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
  const hasGeminiKey = geminiSettings.apiKey.trim().length > 0

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
    chrome.storage.local.get(
      [SITE_BLACKLIST_KEY, GEMINI_SETTINGS_STORAGE_KEY],
      (res) => {
        if (chrome.runtime.lastError) return
        setSiteBlacklist(parseSiteBlacklist(res[SITE_BLACKLIST_KEY]))
        setGeminiSettings(parseGeminiSettings(res[GEMINI_SETTINGS_STORAGE_KEY]))
      },
    )
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
      if (changes[GEMINI_SETTINGS_STORAGE_KEY]?.newValue != null) {
        setGeminiSettings(
          parseGeminiSettings(changes[GEMINI_SETTINGS_STORAGE_KEY].newValue),
        )
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

  function saveGeminiSettingsHandler(): void {
    persistGeminiSettings(geminiSettings)
  }

  async function runMagicGenerate(): Promise<void> {
    try {
      setError(null)
      const settings = await loadGeminiSettings()
      if (!settings.apiKey.trim()) {
        setError('Add your Gemini API key in Settings to use Magic.')
        setPopupTab('settings')
        return
      }
      setMagicBusy(true)
      const out = await generateMagicPrompt(magicGoal, settings.apiKey)
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
        <FolderSidebar
          folders={folders}
          selectedFolderId={selectedFolderId}
          onSelectFolder={(id) => void selectFolder(id)}
          dropTargetFolderId={dropTargetFolderId}
          onDropTargetChange={setDropTargetFolderId}
          onMovePrompt={(pid, fid) => void handleMovePrompt(pid, fid)}
          newFolderName={newFolderName}
          onNewFolderNameChange={setNewFolderName}
          onCreateFolder={() => void handleCreateFolder()}
          onDeleteFolder={(id) => void handleDeleteFolder(id)}
        />
      ) : null}

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <PopupHeader
          promptsUsed={promptsUsed}
          minutesSaved={minutesSaved}
          popupTab={popupTab}
          onTabChange={setPopupTab}
        />

        <main className="relative flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {error ? (
            <p className="rounded-2xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
              {error}
            </p>
          ) : null}

          {popupTab === 'library' ? (
            <LibraryTab
              currentFolder={currentFolder}
              folders={folders}
              title={title}
              content={content}
              loading={loading}
              prompts={prompts}
              titleInputRef={titleInputRef}
              addFormRef={addFormRef}
              onTitleChange={setTitle}
              onContentChange={setContent}
              onAdd={(e) => void handleAdd(e)}
              onDeletePrompt={(id) => void handleDeletePrompt(id)}
              onMovePrompt={(pid, fid) => void handleMovePrompt(pid, fid)}
              onDropTargetChange={setDropTargetFolderId}
              shareCopiedId={shareCopiedId}
              onCopyPortable={(p) => void copyPortablePrompt(p)}
              focusAddPromptForm={focusAddPromptForm}
            />
          ) : null}

          {popupTab === 'magic' ? (
            <MagicTab
              magicGoal={magicGoal}
              onMagicGoalChange={setMagicGoal}
              magicBusy={magicBusy}
              onGenerate={() => void runMagicGenerate()}
              magicTitle={magicTitle}
              magicContent={magicContent}
              onMagicTitleChange={setMagicTitle}
              onMagicContentChange={setMagicContent}
              onAddToLibrary={() => void addMagicPromptToLibrary()}
              hasGeminiKey={hasGeminiKey}
              onOpenSettings={() => setPopupTab('settings')}
            />
          ) : null}

          {popupTab === 'settings' ? (
            <SettingsTab
              loading={loading}
              totalPrompts={totalPrompts}
              onExportBackup={() => void handleExportBackup()}
              onImportBackupClick={() => importInputRef.current?.click()}
              importInputRef={importInputRef}
              onImportBackupFile={(e) => void handleImportBackupFile(e)}
              onLoadStarterPack={() => void handleLoadStarterPack()}
              sharePaste={sharePaste}
              onSharePasteChange={setSharePaste}
              onImportPortable={importPortablePrompt}
              geminiSettings={geminiSettings}
              onGeminiApiKeyChange={(v) =>
                setGeminiSettings((s) => ({ ...s, apiKey: v }))
              }
              onSaveGeminiSettings={saveGeminiSettingsHandler}
              blacklistDraft={blacklistDraft}
              onBlacklistDraftChange={setBlacklistDraft}
              onAddBlacklistRule={addBlacklistRule}
              siteBlacklist={siteBlacklist}
              onRemoveBlacklistRule={removeBlacklistRule}
            />
          ) : null}
        </main>
      </div>
    </div>
  )
}
