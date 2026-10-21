import { ArrowUp, AtSign, Route, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { projectById } from '../config'
import { useStore } from '../store'
import { cx } from '../util'
import { ProjectIcon } from './icons'

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-white/10 bg-white/[0.04] px-1 font-mono text-[10px] text-slate-400">
      {children}
    </kbd>
  )
}

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

  const placeholder = `Pide algo a tus agentes… usa ${projects
    .filter((p) => !p.fallback)
    .slice(0, 3)
    .map((p) => `@${p.aliases[0]}`)
    .join(', ')} para dirigirlo`

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
    <div className="relative border-t border-white/[0.06] bg-hq-bg/95 px-5 pb-4 pt-3 backdrop-blur-xl">
      {question && (
        <div className="mb-3 rounded-xl border border-violet-400/20 bg-gradient-to-b from-violet-500/[0.09] to-violet-500/[0.03] p-3.5">
          <div className="mb-3 flex items-start gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-500/15 text-violet-300 ring-1 ring-inset ring-violet-400/25">
              <Route size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-violet-50">{question.text}</div>
              <div className="mt-0.5 truncate text-[12px] text-violet-200/60">«{question.prompt}»</div>
            </div>
            <button onClick={dismiss} className="rounded-md p-1 text-violet-200/60 hover:bg-white/5 hover:text-white" aria-label="Cancelar">
              <X size={15} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2 pl-10">
            {question.options.map((id) => {
              const p = projectById(id)
              return (
                <button
                  key={id}
                  onClick={() => answer([id])}
                  className="inline-flex h-8 items-center gap-2 rounded-lg bg-white/[0.04] pl-1.5 pr-3 text-[12px] font-medium text-slate-200 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.08] hover:text-white"
                >
                  <ProjectIcon icon={p.icon} color={p.color} size="sm" />
                  {p.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <ul className="absolute bottom-full left-5 mb-1 w-80 overflow-hidden rounded-xl border border-white/10 bg-hq-card/95 p-1 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <li className="px-2.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Proyectos</li>
          {suggestions.map((p, i) => (
            <li key={p.id}>
              <button
                onMouseDown={(e) => (e.preventDefault(), complete(p.aliases[0]))}
                className={cx('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left', i === hi ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]')}
              >
                <ProjectIcon icon={p.icon} color={p.color} size="sm" />
                <span className="truncate text-[13px] text-slate-100">{p.name}</span>
                <span className="ml-auto font-mono text-[11px] text-slate-500">@{p.aliases[0]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2 rounded-xl bg-white/[0.035] p-1.5 pl-4 ring-1 ring-inset ring-white/[0.08] transition focus-within:bg-white/[0.05] focus-within:ring-violet-400/40">
        <AtSign size={16} className="shrink-0 text-slate-500" />
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => (setDraft(e.target.value), setHi(0))}
          onKeyDown={onKey}
          placeholder={placeholder}
          className="h-9 min-w-0 flex-1 bg-transparent text-[14px] text-white placeholder:text-slate-500 focus:outline-none"
        />
        <span className={cx('hidden items-center gap-1.5 text-[11px] text-violet-300 transition-opacity duration-500 md:flex', noteVisible ? 'opacity-100' : 'opacity-0')}>
          <Route size={12} /> {note?.text}
        </span>
        <span className={cx('hidden items-center gap-1 text-[11px] text-slate-500 lg:flex', noteVisible && 'lg:hidden')}>
          <Kbd>@</Kbd> proyecto <Kbd>↵</Kbd> enviar
        </span>
        <button
          onClick={() => send(draft)}
          disabled={!draft.trim()}
          aria-label="Enviar"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-500 text-white shadow-lg shadow-violet-500/25 transition hover:bg-violet-400 disabled:bg-white/[0.06] disabled:text-slate-500 disabled:shadow-none"
        >
          <ArrowUp size={17} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  )
}
