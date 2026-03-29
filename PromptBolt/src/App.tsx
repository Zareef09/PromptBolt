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
    <div className="relative min-w-[380px] max-w-[420px] overflow-hidden bg-bolt-void">
      <div
        className="pointer-events-none absolute -left-24 -top-20 h-56 w-56 rounded-full bg-fuchsia-600/25 blur-[72px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-16 -right-20 h-52 w-52 rounded-full bg-cyan-500/20 blur-[64px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 h-40 w-40 -translate-x-1/2 rounded-full bg-violet-600/15 blur-[56px]"
        aria-hidden
      />

      <header className="relative border-b border-zinc-800/80 bg-bolt-ink/90 px-5 py-4 backdrop-blur-md">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-fuchsia-400/90">
              Prompt
              <span className="text-cyan-400">Bolt</span>
            </p>
            <h1 className="font-display mt-1 text-2xl font-extrabold leading-none tracking-tight text-gen-gradient">
              your text arsenal
            </h1>
          </div>
          <span className="shrink-0 rounded-full border border-lime-300/30 bg-lime-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-lime-300">
            main character mode
          </span>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-zinc-500">
          Hit{' '}
          <kbd className="rounded-lg border border-fuchsia-500/40 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] text-fuchsia-300 shadow-glow">
            ⌘⇧K
          </kbd>{' '}
          anywhere — boom, palette drops. no cap it slaps ✨
        </p>
      </header>

      <main className="relative space-y-5 px-5 py-5">
        {error ? (
          <p className="rounded-2xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
            {error}
          </p>
        ) : null}

        <form
          onSubmit={handleAdd}
          className="space-y-4 rounded-2xl border border-zinc-800 bg-bolt-card/90 p-4 shadow-[0_0_32px_-8px_rgba(232,121,249,0.2)] ring-1 ring-fuchsia-500/15 backdrop-blur-sm"
        >
          <div>
            <label
              htmlFor="title"
              className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-lime-400 shadow-[0_0_8px_#bef264]" />
              Title
            </label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="something unhinged but professional"
              className="w-full rounded-xl border border-zinc-800 bg-black/60 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-fuchsia-500/60 focus:ring-2 focus:ring-fuchsia-500/25"
            />
          </div>
          <div>
            <label
              htmlFor="content"
              className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
              Content
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="paste the whole copy… [Name] vars supported in palette"
              rows={4}
              className="w-full resize-none rounded-xl border border-zinc-800 bg-black/60 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/25"
            />
          </div>
          <button
            type="submit"
            className="font-display w-full rounded-xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-cyan-500 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-glow transition hover:brightness-110 active:scale-[0.98]"
          >
            + add to stash
          </button>
        </form>

        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-xs font-bold uppercase tracking-widest text-zinc-500">
            <span className="text-gen-gradient">library</span>
            <span className="h-px flex-1 bg-gradient-to-r from-zinc-800 to-transparent" />
          </h2>
          {loading ? (
            <p className="animate-pulse text-sm text-zinc-600">loading your rizz…</p>
          ) : prompts.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/50 px-4 py-8 text-center text-sm leading-relaxed text-zinc-500">
              empty vault — add a prompt and show the algorithm who&apos;s boss fr
            </p>
          ) : (
            <ul className="custom-scrollbar max-h-64 space-y-2.5 overflow-y-auto pr-1">
              {prompts.map((p) => (
                <li
                  key={p.id}
                  className="group flex gap-3 rounded-2xl border border-zinc-800/90 bg-zinc-950/70 p-3.5 transition hover:border-fuchsia-500/35 hover:shadow-[0_0_20px_-4px_rgba(232,121,249,0.2)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm font-bold text-zinc-100">
                      {p.title}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500 group-hover:text-zinc-400">
                      {p.content}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDelete(p.id)}
                    className="shrink-0 self-start rounded-lg border border-rose-500/30 bg-rose-950/30 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-rose-400 transition hover:border-rose-400/50 hover:bg-rose-950/60 hover:text-rose-300"
                  >
                    yeet
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
