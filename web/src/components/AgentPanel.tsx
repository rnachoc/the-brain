import { useEffect, useMemo, useRef, useState } from 'react'
import { projectById } from '../config'
import { agentStatus, useStore } from '../store'
import type { LogLevel } from '../types'
import { AGENT_META, cx, fmtDateTime, fmtTime, timeAgo } from '../util'
import { Plus, X } from 'lucide-react'
import { DraftCard, StatusChip } from './bits'
import { ProjectIcon } from './icons'

type PanelTab = 'orders' | 'log' | 'history'

const LOG_COLOR: Record<LogLevel, string> = {
  info: 'text-slate-300',
  tool: 'text-cyan-300/80',
  warn: 'text-rose-300',
  error: 'text-red-400',
  approval: 'text-amber-300',
}

export function AgentPanel() {
  const id = useStore((s) => s.selectedProjectId)
  const close = useStore((s) => s.selectProject)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  if (!id) return null
  return <Panel key={id} projectId={id} onClose={() => close(null)} />
}

function Panel({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const p = projectById(projectId)
  const status = useStore((s) => agentStatus(s, projectId))
  const allRuns = useStore((s) => s.runs)
  const allOrders = useStore((s) => s.orders)
  const allLogs = useStore((s) => s.logs)
  const setDraft = useStore((s) => s.setChatDraft)
  const [tab, setTab] = useState<PanelTab>('orders')
  const logRef = useRef<HTMLDivElement>(null)

  const runs = useMemo(() => allRuns.filter((r) => r.projectId === projectId).sort((a, b) => b.startedAt - a.startedAt), [allRuns, projectId])
  const orders = useMemo(() => allOrders.filter((o) => o.projectId === projectId), [allOrders, projectId])
  const logs = useMemo(() => allLogs.filter((l) => l.projectId === projectId), [allLogs, projectId])

  useEffect(() => {
    if (tab === 'log') logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [logs.length, tab])

  const meta = AGENT_META[status]

  return (
    <aside className="panel-in absolute bottom-0 right-0 top-0 z-30 flex w-[440px] max-w-full flex-col border-l border-white/10 bg-hq-panel/95 shadow-2xl backdrop-blur-xl">
      <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${p.color}, transparent)` }} />
      <div className="flex items-start gap-3 px-5 pb-3 pt-4">
        <ProjectIcon icon={p.icon} color={p.color} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-lg font-semibold text-white">{p.name}</h2>
            <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: meta.color, background: `${meta.color}1a` }}>
              <span className={cx('h-1.5 w-1.5 rounded-full', status !== 'idle' && 'animate-pulse')} style={{ background: meta.color }} />
              {meta.label}
            </span>
          </div>
          <p className="mt-0.5 text-xs leading-snug text-slate-400">{p.description}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {p.tools.map((t) => (
              <span key={t} className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                {t}
              </span>
            ))}
          </div>
        </div>
        <button onClick={onClose} className="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Cerrar">
          <X size={16} />
        </button>
      </div>

      <div className="flex items-center gap-1 border-b border-white/5 px-4">
        {(
          [
            ['orders', `Tareas (${orders.length})`],
            ['log', 'Log en vivo'],
            ['history', `Historial (${runs.length})`],
          ] as [PanelTab, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cx('-mb-px border-b-2 px-3 py-2 text-sm', tab === k ? 'text-white' : 'border-transparent text-slate-400 hover:text-slate-200')}
            style={tab === k ? { borderColor: p.color } : undefined}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => setDraft(`@${p.aliases[0]} `)}
          className="btn btn-ghost btn-sm ml-auto"
        >
          <Plus size={13} /> Nueva orden
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'orders' && (
          <div className="space-y-4 p-4">
            {runs.length === 0 && <Empty text="Este agente aún no tiene tareas." />}
            {runs.map((r) => (
              <div key={r.id}>
                <div className="mb-1.5 flex items-baseline gap-2">
                  <span className="truncate text-sm font-medium text-slate-200">«{r.prompt}»</span>
                  <span className="ml-auto shrink-0 text-[11px] text-slate-500">{timeAgo(r.startedAt)}</span>
                </div>
                <ol className="space-y-1 border-l pl-3" style={{ borderColor: `${p.color}40` }}>
                  {orders
                    .filter((o) => o.runId === r.id)
                    .sort((a, b) => a.seq - b.seq)
                    .map((o) => (
                      <li key={o.id} className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] tabular-nums text-slate-600">{o.seq + 1}.</span>
                          <span className={cx('min-w-0 flex-1 truncate text-sm', o.status === 'done' ? 'text-slate-400' : 'text-slate-200')}>{o.title}</span>
                          <StatusChip status={o.status} />
                        </div>
                        {o.note && <div className="pl-5 text-[11px] text-slate-500">{o.note}</div>}
                        {o.draft && <DraftCard order={o} />}
                      </li>
                    ))}
                </ol>
              </div>
            ))}
          </div>
        )}

        {tab === 'log' && (
          <div ref={logRef} className="h-full overflow-y-auto bg-black/30 p-3 font-mono text-[11.5px] leading-relaxed">
            {logs.length === 0 && <Empty text="Sin actividad." />}
            {logs.map((l) => (
              <div key={l.id} className="flex gap-2" title={l.detail}>
                <span className="shrink-0 text-slate-600">{fmtTime(l.ts)}</span>
                <span className={cx(LOG_COLOR[l.level], l.level === 'tool' && 'pl-3')}>
                  {l.level === 'tool' && <span className="text-slate-600">⚙ </span>}
                  {l.text}
                </span>
              </div>
            ))}
            {status === 'running' && <div className="mt-1 animate-pulse text-slate-500">▍</div>}
          </div>
        )}

        {tab === 'history' && (
          <ul className="divide-y divide-white/5">
            {runs.length === 0 && <Empty text="Sin historial." />}
            {runs.map((r) => {
              const os = orders.filter((o) => o.runId === r.id)
              const done = os.filter((o) => o.status === 'done').length
              return (
                <li key={r.id} className="px-5 py-3">
                  <div className="text-sm text-slate-200">{r.prompt}</div>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500">
                    <span>{fmtDateTime(r.startedAt)}</span>
                    <span>
                      {done}/{os.length} órdenes
                    </span>
                    <span className={cx('rounded px-1.5', r.live ? 'bg-violet-500/15 text-violet-300' : 'bg-white/5')}>
                      {r.live ? 'Claude' : 'simulado'}
                    </span>
                    {r.costUsd != null && r.costUsd > 0 && <span>${r.costUsd.toFixed(3)}</span>}
                    <span className="ml-auto uppercase tracking-wider" style={{ color: r.status === 'done' ? '#34d399' : r.status === 'waiting' ? '#f59e0b' : '#38bdf8' }}>
                      {r.status}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded bg-white/5">
                    <div className="h-full rounded transition-all" style={{ width: `${(done / Math.max(os.length, 1)) * 100}%`, background: p.color }} />
                  </div>
                  {r.result && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[11px] text-slate-400 hover:text-slate-200">Resultado</summary>
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-300">{r.result}</p>
                    </details>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <details className="border-t border-white/5 px-5 py-2 text-xs text-slate-500">
        <summary className="cursor-pointer select-none hover:text-slate-300">System prompt · {p.folder}</summary>
        <p className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed text-slate-400">{p.systemPrompt}</p>
      </details>
    </aside>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="px-5 py-8 text-center text-sm text-slate-500">{text}</div>
}
