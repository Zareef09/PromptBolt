/**
 * @fileoverview Branded header for the popup: title, usage stats, tab navigation, and shortcut hint.
 */

import type { PopupTab } from './types'

type Props = {
  promptsUsed: number
  minutesSaved: number
  popupTab: PopupTab
  onTabChange: (tab: PopupTab) => void
}

function tabBtn(
  id: PopupTab,
  label: string,
  active: PopupTab,
  onClick: (tab: PopupTab) => void,
) {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wide transition ${
        active === id
          ? 'bg-gradient-to-r from-fuchsia-600/90 to-cyan-600/80 text-white shadow-glow'
          : 'border border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
      }`}
    >
      {label}
    </button>
  )
}

function paletteShortcutLabel(): string {
  if (typeof navigator === 'undefined') return '⌘⇧K'
  const p = navigator.platform ?? ''
  const ua = navigator.userAgent ?? ''
  const apple =
    /Mac|iPhone|iPad|iPod/.test(p) ||
    ua.includes('Mac OS') ||
    p === 'iPhone'
  return apple ? '⌘⇧K' : 'Ctrl+Shift+K'
}

export function PopupHeader({
  promptsUsed,
  minutesSaved,
  popupTab,
  onTabChange,
}: Props) {
  const shortcut = paletteShortcutLabel()
  return (
    <header className="border-b border-zinc-800/80 bg-bolt-ink/90 px-5 py-4 backdrop-blur-md">
      <h1 className="font-display text-4xl font-extrabold leading-none tracking-tight">
        <span className="bg-gradient-to-br from-slate-100 via-slate-200 to-slate-500 bg-clip-text text-transparent">
          Prompt
        </span>
        <span className="bg-gradient-to-br from-cyan-200 via-fuchsia-300 to-violet-400 bg-clip-text text-transparent">
          Bolt
        </span>
      </h1>
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
              {minutesSaved} {minutesSaved === 1 ? 'minute' : 'minutes'}
            </span>
          </div>
        </div>
      </div>
      <nav
        className="mt-3 flex flex-wrap gap-1.5 rounded-xl border border-zinc-800/80 bg-black/25 p-1.5 ring-1 ring-fuchsia-500/10 backdrop-blur-md"
        aria-label="Popup sections"
      >
        {tabBtn('library', 'Library', popupTab, onTabChange)}
        {tabBtn('magic', 'Magic', popupTab, onTabChange)}
        {tabBtn('settings', 'Settings', popupTab, onTabChange)}
      </nav>

      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2">
        <span className="text-sm font-medium text-zinc-400">Press</span>
        <kbd className="inline-flex min-h-[2.25rem] min-w-[2.75rem] items-center justify-center rounded-xl border-2 border-fuchsia-400/70 bg-zinc-950 px-3 py-2 font-mono text-base font-bold leading-none text-fuchsia-200 shadow-[0_0_20px_rgba(232,121,249,0.45),0_2px_0_rgba(0,0,0,0.4)_inset]">
          {shortcut}
        </kbd>
        <span className="text-sm leading-snug text-zinc-400">
          on any page to open the palette.
        </span>
      </div>
    </header>
  )
}
