/**
 * @fileoverview Magic tab: natural-language prompt generation via Gemini (saved templates use [Variable] syntax).
 */

type Props = {
  magicGoal: string
  onMagicGoalChange: (v: string) => void
  magicBusy: boolean
  onGenerate: () => void
  magicTitle: string
  magicContent: string
  onMagicTitleChange: (v: string) => void
  onMagicContentChange: (v: string) => void
  onAddToLibrary: () => void
  hasGeminiKey: boolean
  onOpenSettings: () => void
}

export function MagicTab({
  magicGoal,
  onMagicGoalChange,
  magicBusy,
  onGenerate,
  magicTitle,
  magicContent,
  onMagicTitleChange,
  onMagicContentChange,
  onAddToLibrary,
  hasGeminiKey,
  onOpenSettings,
}: Props) {
  return (
    <div className="space-y-4 rounded-2xl border border-zinc-800 bg-bolt-card/90 p-4 shadow-[0_0_32px_-8px_rgba(232,121,249,0.15)] ring-1 ring-violet-500/15 backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        AI prompt from a goal
      </p>
      <p className="text-xs text-zinc-500">
        Output uses{' '}
        <span className="font-mono text-emerald-400/90">[Variables]</span> — the
        same placeholders as manual prompts, so search and the palette work
        immediately.
      </p>

      {!hasGeminiKey ? (
        <div
          className="rounded-xl border border-amber-500/35 bg-amber-950/35 px-3 py-3 text-sm text-amber-100/95"
          role="status"
        >
          <p>Add your Gemini API key in Settings to use Magic.</p>
          <button
            type="button"
            onClick={onOpenSettings}
            className="mt-2 w-full rounded-lg border border-amber-500/40 bg-amber-950/50 py-2 text-[11px] font-bold uppercase tracking-wide text-amber-200 transition hover:bg-amber-950/70"
          >
            Open Settings
          </button>
        </div>
      ) : null}

      <textarea
        value={magicGoal}
        onChange={(e) => onMagicGoalChange(e.target.value)}
        placeholder='e.g. "Write a concise follow-up after a technical interview"'
        rows={4}
        className="w-full resize-none rounded-xl border border-zinc-800 bg-black/60 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
      />
      <button
        type="button"
        disabled={magicBusy || !hasGeminiKey}
        onClick={onGenerate}
        className="font-display w-full rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-glow transition hover:brightness-110 disabled:opacity-50"
      >
        {magicBusy ? 'Generating…' : 'Generate'}
      </button>
      {(magicTitle || magicContent) && (
        <div className="space-y-3 border-t border-zinc-800/80 pt-4">
          <input
            value={magicTitle}
            onChange={(e) => onMagicTitleChange(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-black/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-500/50"
            placeholder="Title"
          />
          <textarea
            value={magicContent}
            onChange={(e) => onMagicContentChange(e.target.value)}
            rows={8}
            className="w-full resize-none rounded-xl border border-zinc-800 bg-black/60 px-3 py-2.5 font-mono text-xs text-zinc-200 outline-none focus:border-cyan-500/50"
            placeholder="Generated prompt body"
          />
          <button
            type="button"
            onClick={onAddToLibrary}
            className="w-full rounded-xl border border-emerald-500/35 bg-emerald-950/30 py-2.5 text-xs font-bold uppercase tracking-wide text-emerald-200 transition hover:bg-emerald-950/45"
          >
            Add to current folder
          </button>
        </div>
      )}
    </div>
  )
}
