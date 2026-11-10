// Tarjeta del empleado seleccionado: estado, decisiones pendientes, actividad, próxima programada y órdenes directas.
import { Check, ChevronLeft, ChevronRight, ExternalLink, PanelRight, Play, Send, Square, Terminal, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { DraftCard } from '../../components/bits'
import { projectById } from '../../config'
import { agentStatus, employeeLine, nextSchedule, useStore } from '../../store'
import { cx, fmtDateTime, timeAgo } from '../../util'
import { employeeName, employeeRole } from '../look'

/** "Publicar el reel de hoy" → "Aprobar y publicar". */
const approveLabel = (action?: { label: string }) => (action ? `Aprobar y ${action.label.split(/\s+/)[0].toLowerCase()}` : 'Aprobar')

const TONE = { ok: 'bg-emerald-400', warn: 'bg-[#F5B800]', error: 'bg-rose-400' }

function Block({ tone, label, children }: { tone: 'run' | 'wait' | 'idle'; label: string; children: React.ReactNode }) {
  return (
    <div
      className={cx(
        'rounded-lg px-3 py-2.5 ring-1 ring-inset',
        tone === 'wait' ? 'bg-[#F5B800]/[0.08] ring-[#F5B800]/30' : tone === 'run' ? 'bg-emerald-400/[0.07] ring-emerald-400/25' : 'bg-white/[0.03] ring-white/[0.07]',
      )}
    >
      <div className={cx('text-[11px] font-semibold', tone === 'wait' ? 'text-[#F5B800]' : tone === 'run' ? 'text-emerald-300' : 'text-slate-400')}>{label}</div>
      {children}
    </div>
  )
}

export function AgentCard({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const p = projectById(projectId)
  const status = useStore((s) => agentStatus(s, projectId))
  const line = useStore((s) => employeeLine(s, projectId))
  const orders = useStore((s) => s.orders)
  const runs = useStore((s) => s.runs)
  const logs = useStore((s) => s.logs)
  const next = useStore(useShallow((s) => nextSchedule(s, projectId)))
  const signal = useStore((s) => s.signals[projectId])
  const { approve, reject, cancelRun, send, runScheduleNow, showDetail, launchAction } = useStore(
    useShallow((s) => ({
      approve: s.approve,
      reject: s.reject,
      cancelRun: s.cancelRun,
      send: s.send,
      runScheduleNow: s.runScheduleNow,
      showDetail: s.showDetail,
      launchAction: s.launchAction,
    })),
  )
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)
  const [i, setI] = useState(0)

  const waiting = useMemo(() => orders.filter((o) => o.projectId === projectId && o.status === 'awaiting_approval').sort((a, b) => a.updatedAt - b.updatedAt), [orders, projectId])
  const running = useMemo(() => orders.filter((o) => o.projectId === projectId && o.status === 'running').sort((a, b) => b.updatedAt - a.updatedAt)[0], [orders, projectId])
  const activeRun = useMemo(() => runs.find((r) => r.projectId === projectId && (r.status === 'running' || r.status === 'waiting')), [runs, projectId])
  const recent = useMemo(() => logs.filter((l) => l.projectId === projectId && l.level !== 'tool').slice(-3).reverse(), [logs, projectId])
  const order = waiting[Math.min(i, waiting.length - 1)]

  useEffect(() => {
    if (!sent) return
    const t = setTimeout(() => setSent(false), 3500)
    return () => clearTimeout(t)
  }, [sent])

  const submit = () => {
    if (!text.trim()) return
    send(`@${p.aliases[0]} ${text.trim()}`)
    setText('')
    setSent(true)
  }

  return (
    <div className="pointer-events-auto w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl bg-[#0d1017]/90 shadow-2xl shadow-black/40 ring-1 ring-inset ring-white/10 backdrop-blur-md">
      <div className="flex items-start gap-2 px-4 pb-2 pt-3.5">
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-semibold leading-tight text-white">{employeeName(p)}</div>
          <div className="mt-0.5 truncate text-[12px] font-medium text-[#F5B800]">
            {employeeRole(p)}
            {p.department?.trim() && <span className="font-normal text-slate-500"> · {p.department.trim()}</span>}
          </div>
        </div>
        <button onClick={onClose} title="Cerrar (Esc)" className="rounded-md p-1 text-slate-500 hover:bg-white/10 hover:text-white">
          <X size={15} />
        </button>
      </div>

      <div className="max-h-[38vh] space-y-2.5 overflow-y-auto px-4 pb-3">
        {order ? (
          <Block tone="wait" label="Espera tu decisión">
            <div className="mt-1 flex items-center gap-2">
              <div className="min-w-0 flex-1 text-[13px] text-slate-100">{order.title}</div>
              {waiting.length > 1 && (
                <div className="flex shrink-0 items-center gap-0.5 text-[11px] tabular-nums text-slate-400">
                  <button onClick={() => setI((i - 1 + waiting.length) % waiting.length)} className="rounded p-0.5 hover:bg-white/10 hover:text-white" aria-label="Anterior">
                    <ChevronLeft size={14} />
                  </button>
                  {Math.min(i, waiting.length - 1) + 1} de {waiting.length}
                  <button onClick={() => setI((i + 1) % waiting.length)} className="rounded p-0.5 hover:bg-white/10 hover:text-white" aria-label="Siguiente">
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
            {order.draft && (
              <div className="mt-2">
                <DraftCard order={order} bare />
              </div>
            )}
            <div className="mt-2.5 flex gap-2">
              <button onClick={() => approve(order.id)} className="btn h-8 flex-1 justify-center bg-[#F5B800] text-[#1b1406] hover:bg-[#ffc824]">
                <Check size={14} strokeWidth={2.6} /> {approveLabel(order.action)}
              </button>
              <button onClick={() => reject(order.id)} className="btn h-8 flex-1 justify-center bg-white/[0.06] text-slate-200 ring-1 ring-inset ring-white/10 hover:bg-white/10">
                <X size={14} strokeWidth={2.6} /> Rechazar
              </button>
            </div>
          </Block>
        ) : status === 'running' ? (
          <Block tone="run" label="Trabajando">
            <div className="mt-1 flex items-center gap-2">
              <div className="min-w-0 flex-1 text-[13px] text-slate-100">{running?.title ?? line}</div>
              {activeRun && (
                <button onClick={() => cancelRun(activeRun.id)} className="btn btn-ghost-danger btn-sm shrink-0">
                  <Square size={11} strokeWidth={3} /> Detener
                </button>
              )}
            </div>
          </Block>
        ) : (
          <Block tone="idle" label="Libre">
            <div className="mt-1 text-[13px] text-slate-300">{line === 'Libre' ? 'Sin tareas en curso' : line}</div>
          </Block>
        )}

        {signal && (
          <div className="rounded-lg bg-white/[0.03] px-3 py-2 ring-1 ring-inset ring-white/[0.06]">
            <div className="flex items-center gap-2 text-[12px] text-slate-200">
              <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', TONE[signal.tone])} />
              <span className="min-w-0 flex-1 truncate">{signal.headline}</span>
            </div>
            {signal.items.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                {signal.items.slice(0, 4).map((it) => (
                  <span key={it.label}>
                    {it.label} <span className="font-semibold text-slate-200">{it.value}</span> {it.delta && <span className="text-emerald-300">{it.delta}</span>}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {!order && !!p.actions?.length && (
          <div className="flex flex-wrap gap-1.5">
            {p.actions.map((a) => (
              <button key={a.id} onClick={() => launchAction(p.id, a.id)} title={`Pide tu aprobación antes de ejecutar: ${a.command}`} className="btn btn-ghost btn-sm">
                <Terminal size={12} /> {a.label}
              </button>
            ))}
          </div>
        )}

        {recent.length > 0 && (
          <ul className="space-y-1">
            {recent.map((l) => (
              <li key={l.id} className="flex gap-2 text-[12px] leading-snug">
                <span className="w-14 shrink-0 text-right tabular-nums text-slate-600">{timeAgo(l.ts)}</span>
                <span className="min-w-0 flex-1 truncate text-slate-400">{l.text}</span>
              </li>
            ))}
          </ul>
        )}

        {next && (
          <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2 ring-1 ring-inset ring-white/[0.06]">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-slate-500">Próxima programada · {fmtDateTime(next.at)}</div>
              <div className="truncate text-[12px] text-slate-200">{next.title}</div>
            </div>
            <button onClick={() => runScheduleNow(next.id)} className="btn btn-ghost btn-sm shrink-0">
              <Play size={11} /> Ejecutar ahora
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-white/[0.07] px-4 py-3">
        <div className="flex items-center gap-2 rounded-lg bg-white/[0.04] p-1 pl-3 ring-1 ring-inset ring-white/[0.08] focus-within:ring-[#F5B800]/50">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Dale una orden…"
            className="h-7 min-w-0 flex-1 bg-transparent text-[13px] text-white placeholder:text-slate-500 focus:outline-none"
          />
          <button onClick={submit} disabled={!text.trim()} className="btn h-7 bg-[#F5B800] px-2.5 text-[#1b1406] hover:bg-[#ffc824] disabled:bg-white/[0.06] disabled:text-slate-500">
            <Send size={12} /> Enviar
          </button>
        </div>
        <div className="mt-2 flex items-center gap-3 text-[12px]">
          {sent ? (
            <span className="text-emerald-300">Hecho. Empieza ahora mismo.</span>
          ) : (
            <button onClick={() => showDetail(true)} className="inline-flex items-center gap-1 text-slate-400 hover:text-white">
              <PanelRight size={13} /> Ver detalle
            </button>
          )}
          {p.claudeUrl && (
            <a href={p.claudeUrl} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-slate-400 hover:text-white">
              <ExternalLink size={13} /> Abrir en Claude
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
