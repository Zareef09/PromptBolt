/**
 * @fileoverview Left rail: folder list, drag targets, and folder CRUD in the popup Library tab.
 */

import type { Folder } from '@bolt-types/prompt'
import { PROMPT_DRAG_MIME } from './constants'

type Props = {
  folders: Folder[]
  selectedFolderId: string
  onSelectFolder: (id: string) => void
  dropTargetFolderId: string | null
  onDropTargetChange: (id: string | null) => void
  onMovePrompt: (promptId: string, folderId: string) => void
  newFolderName: string
  onNewFolderNameChange: (v: string) => void
  onCreateFolder: () => void
  onDeleteFolder: (folderId: string) => void
}

export function FolderSidebar({
  folders,
  selectedFolderId,
  onSelectFolder,
  dropTargetFolderId,
  onDropTargetChange,
  onMovePrompt,
  newFolderName,
  onNewFolderNameChange,
  onCreateFolder,
  onDeleteFolder,
}: Props) {
  return (
    <aside className="relative z-10 flex w-[132px] shrink-0 flex-col border-r border-zinc-800/90 bg-bolt-ink/95 py-3 pl-3 pr-2 backdrop-blur-md">
      <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        Folders
      </p>
      <nav className="custom-scrollbar mt-2 max-h-[220px] flex-1 space-y-1 overflow-y-auto pr-1">
        {folders.map((f) => (
          <div key={f.id} className="group flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => void onSelectFolder(f.id)}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                onDropTargetChange(f.id)
              }}
              onDrop={(e) => {
                e.preventDefault()
                onDropTargetChange(null)
                const id = e.dataTransfer.getData(PROMPT_DRAG_MIME)
                if (id) void onMovePrompt(id, f.id)
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
                onClick={() => void onDeleteFolder(f.id)}
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
          onChange={(e) => onNewFolderNameChange(e.target.value)}
          placeholder="New folder"
          className="w-full rounded-lg border border-zinc-800 bg-black/50 px-2 py-1.5 text-[11px] text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-fuchsia-500/50"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void onCreateFolder()
          }}
        />
        <button
          type="button"
          onClick={() => void onCreateFolder()}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-1.5 text-[11px] font-medium text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800"
        >
          Add folder
        </button>
      </div>
    </aside>
  )
}
