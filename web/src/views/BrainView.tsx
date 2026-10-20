import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { cx, timeAgo } from '../util'

export function BrainView() {
  const notes = useStore((s) => s.notes)
  const save = useStore((s) => s.saveNote)
  const [path, setPath] = useState(notes[0]?.path ?? '')
  const [mode, setMode] = useState<'preview' | 'edit'>('preview')
  const note = notes.find((n) => n.path === path)
  const [text, setText] = useState(note?.content ?? '')
  const dirty = note ? text !== note.content : false

  useEffect(() => {
    setText(note?.content ?? '')
  }, [path]) // eslint-disable-line react-hooks/exhaustive-deps

  const tree = useMemo(() => {
    const groups = new Map<string, typeof notes>()
    for (const n of [...notes].sort((a, b) => a.path.localeCompare(b.path))) {
      const dir = n.path.includes('/') ? n.path.slice(0, n.path.lastIndexOf('/')) : ''
      groups.set(dir, [...(groups.get(dir) ?? []), n])
    }
    return [...groups.entries()]
  }, [notes])

  const html = useMemo(() => DOMPurify.sanitize(marked.parse(text, { async: false }) as string), [text])

  const create = () => {
    const name = window.prompt('Ruta de la nota (p. ej. proyectos/nuevo.md)')
    if (!name) return
    const p = name.endsWith('.md') ? name : `${name}.md`
    if (!notes.some((n) => n.path === p)) save(p, `# ${p.split('/').pop()!.replace(/\.md$/, '')}\n\n`)
    setPath(p)
    setMode('edit')
  }

  return (
    <div className="flex h-full">
      <aside className="w-64 shrink-0 overflow-y-auto border-r border-white/5 bg-hq-panel/60 p-3">
        <div className="mb-3 flex items-center">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">/brain</span>
          <button onClick={create} className="ml-auto rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-white/5 hover:text-white">
            + Nueva
          </button>
        </div>
        {tree.map(([dir, items]) => (
          <div key={dir} className="mb-2">
            {dir && <div className="px-2 py-1 text-[11px] text-slate-500">📁 {dir}/</div>}
            {items.map((n) => (
              <button
                key={n.path}
                onClick={() => setPath(n.path)}
                className={cx(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                  dir && 'pl-5',
                  n.path === path ? 'bg-violet-500/15 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
                )}
              >
                <span className="text-slate-500">📝</span>
                <span className="truncate">{n.path.split('/').pop()}</span>
              </button>
            ))}
          </div>
        ))}
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        {note ? (
          <>
            <div className="flex items-center gap-3 border-b border-white/5 px-6 py-3">
              <span className="font-mono text-sm text-slate-300">brain/{note.path}</span>
              <span className="text-[11px] text-slate-500">
                editada {timeAgo(note.updatedAt)} por {note.updatedBy}
              </span>
              <div className="ml-auto flex gap-1 rounded-lg bg-white/[0.03] p-1 ring-1 ring-white/5">
                {(['preview', 'edit'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={cx('rounded-md px-3 py-1 text-xs', mode === m ? 'bg-white/10 text-white' : 'text-slate-400')}
                  >
                    {m === 'preview' ? 'Vista previa' : 'Editar'}
                  </button>
                ))}
              </div>
              <button
                disabled={!dirty}
                onClick={() => save(note.path, text)}
                className="rounded-md bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-30"
              >
                Guardar
              </button>
            </div>
            {mode === 'edit' ? (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
                className="flex-1 resize-none bg-transparent p-6 font-mono text-sm leading-relaxed text-slate-200 focus:outline-none"
              />
            ) : (
              <article className="md-preview flex-1 overflow-y-auto p-8" dangerouslySetInnerHTML={{ __html: html }} />
            )}
          </>
        ) : (
          <div className="grid flex-1 place-items-center text-slate-500">Elige una nota</div>
        )}
      </section>
    </div>
  )
}
