import { useCallback, useEffect, useState, type FormEvent } from 'react'

export type Prompt = {
  id: string
  title: string
  content: string
}

const STORAGE_KEY = 'prompts'

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function loadPrompts(): Promise<Prompt[]> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(
      [STORAGE_KEY],
      (result: Record<string, unknown>) => {
        const err = chrome.runtime.lastError
        if (err) {
          reject(new Error(err.message))
          return
        }
        const raw = result[STORAGE_KEY]
        resolve(Array.isArray(raw) ? (raw as Prompt[]) : [])
      },
    )
  })
}

async function savePrompts(prompts: Prompt[]): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEY]: prompts }, () => {
      const err = chrome.runtime.lastError
      if (err) reject(new Error(err.message))
      else resolve()
    })
  })
}

export default function App() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      const next = await loadPrompts()
      setPrompts(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load prompts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

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
      if (areaName === 'local' && changes[STORAGE_KEY]) {
        const nv = changes[STORAGE_KEY].newValue
        if (Array.isArray(nv)) setPrompts(nv as Prompt[])
      }
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const t = title.trim()
    const c = content.trim()
    if (!t || !c) return

    const next: Prompt[] = [
      ...prompts,
      { id: createId(), title: t, content: c },
    ]
    try {
      await savePrompts(next)
      setPrompts(next)
      setTitle('')
      setContent('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  async function handleDelete(id: string) {
    const next = prompts.filter((p) => p.id !== id)
    try {
      await savePrompts(next)
      setPrompts(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  return (
    <div className="min-w-[360px] max-w-[400px] bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">
          PromptBolt
        </h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Press{' '}
          <kbd className="rounded border border-slate-200 bg-slate-100 px-1 py-0.5 font-mono text-[10px]">
            ⌘⇧K
          </kbd>{' '}
          on a page to search and insert.
        </p>
      </header>

      <main className="space-y-4 px-4 py-4">
        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <form onSubmit={handleAdd} className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div>
            <label
              htmlFor="title"
              className="mb-1 block text-xs font-medium text-slate-600"
            >
              Title
            </label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short label"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-indigo-600/0 transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20"
            />
          </div>
          <div>
            <label
              htmlFor="content"
              className="mb-1 block text-xs font-medium text-slate-600"
            >
              Content
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Text to insert on pages"
              rows={4}
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-indigo-600/0 transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
          >
            Add prompt
          </button>
        </form>

        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Your prompts
          </h2>
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : prompts.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-6 text-center text-sm text-slate-500">
              No prompts yet. Add one above.
            </p>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {prompts.map((p) => (
                <li
                  key={p.id}
                  className="flex gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {p.title}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                      {p.content}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDelete(p.id)}
                    className="shrink-0 self-start rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
