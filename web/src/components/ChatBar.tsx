import { useEffect, useMemo, useRef, useState } from 'react'
import { projectById } from '../config'
import { useStore } from '../store'
import { cx } from '../util'

export function ChatBar() {
  const draft = useStore((s) => s.chatDraft)
  const setDraft = useStore((s) => s.setChatDraft)
  const send = useStore((s) => s.send)
  const projects = useStore((s) => s.projects)
  const question = useStore((s) => s.question)
  const answer = useStore((s) => s.answerQuestion)
  const dismiss = useStore((s) => s.dismissQuestion)
  const note = useStore((s) => s.routerNote)
  const inputRef = useRef<HTMLInputElement>(null)
  const [hi, setHi] = useState(0)
  const [noteVisible, setNoteVisible] = useState(false)

  useEffect(() => {
    if (!note) return
    setNoteVisible(true)
    const t = setTimeout(() => setNoteVisible(false), 4000)
    return () => clearTimeout(t)
  }, [note])

  useEffect(() => {
    inputRef.current?.focus()
  }, [draft === ''])

  const placeholder = `Escribe una orden… usa ${projects
    .filter((p) => !p.fallback)
    .slice(0, 3)
    .map((p) => `@${p.aliases[0]}`)
    .join(', ')} para dirigirla`

  const mention = draft.match(/(?:^|\s)@([\p{L}\w-]*)$/u)
  const suggestions = useMemo(() => {
    if (!mention) return []
    const q = mention[1].toLowerCase()
    return projects.filter((p) => p.aliases.some((a) => a.startsWith(q)) || p.name.toLowerCase().includes(q))
  }, [mention?.[1], projects])

  const complete = (alias: string) => {
    setDraft(draft.replace(/@([\p{L}\w-]*)$/u, `@${alias} `))
    setHi(0)
    inputRef.current?.focus()
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (suggestions.length) {
      if (e.key === 'ArrowDown') return e.preventDefault(), setHi((hi + 1) % suggestions.length)
      if (e.key === 'ArrowUp') return e.preventDefault(), setHi((hi - 1 + suggestions.length) % suggestions.length)
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault()
        return complete(suggestions[Math.min(hi, suggestions.length - 1)].aliases[0])
      }
    }
    if (e.key === 'Enter') send(draft)
  }

  return (
    <div className="relative border-t border-white/5 bg-hq-bg/90 px-5 py-3 backdrop-blur">
      {question && (
        <div className="mb-3 rounded-xl border border-violet-400/30 bg-violet-500/10 p-3">
          <div className="mb-2 flex items-start gap-2 text-sm text-violet-100">
            <span>🧭</span>
            <span className="flex-1">
              <b>Router:</b> {question.text} <span className="text-violet-300/70">«{question.prompt}»</span>
            </span>
            <button onClick={dismiss} className="text-xs text-violet-300/70 hover:text-white">
              cancelar
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {question.options.map((id) => {
              const p = projectById(id)
              return (
                <button
                  key={id}
                  onClick={() => answer([id])}
                  className="rounded-md px-2.5 py-1 text-xs font-medium ring-1 hover:brightness-125"
                  style={{ color: p.color, background: `${p.color}14`, boxShadow: `inset 0 0 0 1px ${p.color}40` }}
                >
                  {p.icon} {p.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <ul className="absolute bottom-full left-5 mb-1 w-72 overflow-hidden rounded-lg border border-white/10 bg-hq-card shadow-2xl">
          {suggestions.map((p, i) => (
            <li key={p.id}>
              <button
                onMouseDown={(e) => (e.preventDefault(), complete(p.aliases[0]))}
                className={cx('flex w-full items-center gap-2 px-3 py-2 text-left text-sm', i === hi ? 'bg-white/10' : 'hover:bg-white/5')}
              >
                <span>{p.icon}</span>
                <span className="font-mono text-xs" style={{ color: p.color }}>
                  @{p.aliases[0]}
                </span>
                <span className="truncate text-slate-400">{p.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-xl bg-white/[0.04] px-4 ring-1 ring-white/10 focus-within:ring-violet-400/50">
          <span className="text-slate-500">›</span>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => (setDraft(e.target.value), setHi(0))}
            onKeyDown={onKey}
            placeholder={placeholder}
            className="h-11 flex-1 bg-transparent text-[15px] text-white placeholder:text-slate-500 focus:outline-none"
          />
          <span
            className={cx('text-xs text-violet-300 transition-opacity duration-500', noteVisible ? 'opacity-100' : 'opacity-0')}
          >
            {note?.text}
          </span>
        </div>
        <button
          onClick={() => send(draft)}
          disabled={!draft.trim()}
          className="h-11 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 disabled:opacity-40"
        >
          Enviar
        </button>
      </div>
    </div>
  )
}
