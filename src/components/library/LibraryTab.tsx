/**
 * @fileoverview Library tab: add-prompt form and draggable prompt list for the active folder.
 */

import type { FormEvent, RefObject } from 'react'
import type { Folder, Prompt } from '@bolt-types/prompt'
import { PROMPT_DRAG_MIME } from './constants'

type Props = {
  currentFolder: Folder | undefined
  folders: Folder[]
  title: string
  content: string
  loading: boolean
  prompts: Prompt[]
  titleInputRef: RefObject<HTMLInputElement | null>
  addFormRef: RefObject<HTMLFormElement | null>
  onTitleChange: (v: string) => void
  onContentChange: (v: string) => void
  onAdd: (e: FormEvent<HTMLFormElement>) => void
  onDeletePrompt: (id: string) => void
  onMovePrompt: (promptId: string, folderId: string) => void
  onDropTargetChange: (id: string | null) => void
  shareCopiedId: string | null
  onCopyPortable: (p: Prompt) => void
  focusAddPromptForm: () => void
}

export function LibraryTab({
  currentFolder,
  folders,
  title,
  content,
  loading,
  prompts,
  titleInputRef,
  addFormRef,
  onTitleChange,
  onContentChange,
  onAdd,
  onDeletePrompt,
  onMovePrompt,
  onDropTargetChange,
  shareCopiedId,
  onCopyPortable,
  focusAddPromptForm,
}: Props) {
  return (
    <>
      <p className="text-xs text-zinc-500">
        Editing folder:{' '}
        <span className="font-medium text-zinc-300">
          {currentFolder?.name ?? '—'}
        </span>
      </p>

      <form
        ref={addFormRef}
        onSubmit={(e) => void onAdd(e)}
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
            onChange={(e) => onTitleChange(e.target.value)}
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
            onChange={(e) => onContentChange(e.target.value)}
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
                onDragEnd={() => onDropTargetChange(null)}
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
                        void onMovePrompt(p.id, e.target.value)
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
                    onClick={() => void onCopyPortable(p)}
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
                    onClick={() => void onDeletePrompt(p.id)}
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
  )
}
