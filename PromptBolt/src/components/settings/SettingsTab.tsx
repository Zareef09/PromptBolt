/**
 * @fileoverview Settings tab: backup/import, portable prompts, Gemini API key, and site blacklist.
 */

import type { ChangeEvent, RefObject } from 'react'
import type { GeminiSettingsV1 } from '@bolt-types/settings'

type Props = {
  loading: boolean
  totalPrompts: number
  onExportBackup: () => void
  onImportBackupClick: () => void
  importInputRef: RefObject<HTMLInputElement | null>
  onImportBackupFile: (e: ChangeEvent<HTMLInputElement>) => void
  onLoadStarterPack: () => void
  sharePaste: string
  onSharePasteChange: (v: string) => void
  onImportPortable: () => void
  geminiSettings: GeminiSettingsV1
  onGeminiApiKeyChange: (v: string) => void
  onSaveGeminiSettings: () => void
  blacklistDraft: string
  onBlacklistDraftChange: (v: string) => void
  onAddBlacklistRule: () => void
  siteBlacklist: string[]
  onRemoveBlacklistRule: (rule: string) => void
}

export function SettingsTab({
  loading,
  totalPrompts,
  onExportBackup,
  onImportBackupClick,
  importInputRef,
  onImportBackupFile,
  onLoadStarterPack,
  sharePaste,
  onSharePasteChange,
  onImportPortable,
  geminiSettings,
  onGeminiApiKeyChange,
  onSaveGeminiSettings,
  blacklistDraft,
  onBlacklistDraftChange,
  onAddBlacklistRule,
  siteBlacklist,
  onRemoveBlacklistRule,
}: Props) {
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-zinc-800 bg-black/35 p-4 ring-1 ring-cyan-500/10 backdrop-blur-md">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
          Portable library (JSON)
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onExportBackup}
            className="rounded-lg border border-zinc-700 bg-zinc-900/90 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 transition hover:border-zinc-600"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={onImportBackupClick}
            className="rounded-lg border border-zinc-700 bg-zinc-900/90 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 transition hover:border-zinc-600"
          >
            Import JSON
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(ev) => void onImportBackupFile(ev)}
          />
        </div>
        {!loading && totalPrompts === 0 ? (
          <button
            type="button"
            onClick={onLoadStarterPack}
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
          Paste a code a teammate shared. Adds to the folder selected on the
          Library tab.
        </p>
        <textarea
          value={sharePaste}
          onChange={(e) => onSharePasteChange(e.target.value)}
          placeholder="Paste base64 share token…"
          rows={3}
          className="mt-2 w-full resize-none rounded-xl border border-zinc-800 bg-black/50 px-3 py-2 font-mono text-[11px] text-zinc-300 outline-none focus:border-fuchsia-500/40"
        />
        <button
          type="button"
          onClick={onImportPortable}
          className="mt-2 w-full rounded-xl border border-fuchsia-500/35 bg-fuchsia-950/25 py-2 text-[11px] font-bold uppercase tracking-wide text-fuchsia-200 transition hover:bg-fuchsia-950/40"
        >
          Import portable prompt
        </button>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-black/35 p-4 ring-1 ring-violet-500/10 backdrop-blur-md">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
          Magic — Gemini API key
        </p>
        <p className="mt-1 text-[11px] text-zinc-500">
          Your key stays in{' '}
          <span className="text-zinc-400">chrome.storage.local</span> on this
          device only (never embedded in extension code).
        </p>
        <input
          type="password"
          autoComplete="off"
          value={geminiSettings.apiKey}
          onChange={(e) => onGeminiApiKeyChange(e.target.value)}
          placeholder="Gemini API key (Google AI Studio)"
          className="mt-2 w-full rounded-xl border border-zinc-800 bg-black/60 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-violet-500/45"
        />
        <button
          type="button"
          onClick={onSaveGeminiSettings}
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
            onChange={(e) => onBlacklistDraftChange(e.target.value)}
            placeholder="e.g. chase.com"
            className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-black/60 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-rose-500/35"
            onKeyDown={(e) => {
              if (e.key === 'Enter') onAddBlacklistRule()
            }}
          />
          <button
            type="button"
            onClick={onAddBlacklistRule}
            className="shrink-0 rounded-xl border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-[11px] font-bold uppercase text-rose-200 transition hover:bg-rose-950/45"
          >
            Add
          </button>
        </div>
        <ul className="custom-scrollbar mt-3 max-h-28 space-y-1 overflow-y-auto text-[11px] text-zinc-400">
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
                  onClick={() => onRemoveBlacklistRule(rule)}
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
  )
}
