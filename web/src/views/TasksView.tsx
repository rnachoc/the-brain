import { useMemo, useState } from 'react'
import { ProjectTag, StatusChip } from '../components/bits'
import { useStore } from '../store'
import type { OrderStatus } from '../types'
import { cx, describeRule, fmtDateTime, nextOccurrence, ORDER_META, timeAgo } from '../util'

export function TasksView() {
  const orders = useStore((s) => s.orders)
  const runs = useStore((s) => s.runs)
  const projects = useStore((s) => s.projects)
  const schedules = useStore((s) => s.schedules)
  const select = useStore((s) => s.selectProject)
  const toggle = useStore((s) => s.toggleSchedule)
  const [project, setProject] = useState<string>('all')
  const [status, setStatus] = useState<OrderStatus | 'all'>('all')

  const promptOf = useMemo(() => new Map(runs.map((r) => [r.id, r.prompt])), [runs])
  const list = useMemo(
    () =>
      orders
        .filter((o) => (project === 'all' || o.projectId === project) && (status === 'all' || o.status === status))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [orders, project, status],
  )

  return (
    <div className="mx-auto grid h-full max-w-7xl gap-6 overflow-y-auto p-6 lg:grid-cols-[1fr_360px]">
      <section className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-lg font-semibold text-white">Todas las tareas</h2>
          <select value={project} onChange={(e) => setProject(e.target.value)} className="hq-select">
            <option value="all">Todos los proyectos</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.icon} {p.name}
              </option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus | 'all')} className="hq-select">
            <option value="all">Todos los estados</option>
            {Object.entries(ORDER_META).map(([k, m]) => (
              <option key={k} value={k}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="overflow-hidden rounded-xl border border-white/5 bg-hq-panel/70">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.02] text-left text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Orden</th>
                <th className="px-4 py-2.5 font-medium">Proyecto</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5 text-right font-medium">Actualizada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {list.map((o) => (
                <tr key={o.id} className="hover:bg-white/[0.02]">
                  <td className="max-w-0 px-4 py-2.5">
                    <div className={cx('truncate', o.status === 'done' ? 'text-slate-400' : 'text-slate-100')}>{o.title}</div>
                    <div className="truncate text-[11px] text-slate-500">«{promptOf.get(o.runId)}»</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <ProjectTag id={o.projectId} onClick={() => select(o.projectId)} />
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusChip status={o.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right text-xs text-slate-500">{timeAgo(o.updatedAt)}</td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                    No hay tareas con esos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <aside>
        <h2 className="mb-4 text-lg font-semibold text-white">Programadas</h2>
        <ul className="space-y-2">
          {schedules.map((s) => {
            const next = s.enabled ? nextOccurrence(s.rule) : null
            return (
              <li key={s.id} className={cx('rounded-xl border border-white/5 bg-hq-panel/70 p-3', !s.enabled && 'opacity-50')}>
                <div className="flex items-center gap-2">
                  <ProjectTag id={s.projectId} onClick={() => select(s.projectId)} />
                  <button
                    onClick={() => toggle(s.id)}
                    className={cx('relative ml-auto h-5 w-9 rounded-full transition', s.enabled ? 'bg-emerald-500/70' : 'bg-white/10')}
                    aria-label={s.enabled ? 'Desactivar' : 'Activar'}
                  >
                    <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all', s.enabled ? 'left-[18px]' : 'left-0.5')} />
                  </button>
                </div>
                <div className="mt-2 text-sm font-medium text-slate-100">{s.title}</div>
                <div className="text-xs text-slate-400">{s.prompt}</div>
                <div className="mt-2 flex justify-between text-[11px] text-slate-500">
                  <span>{describeRule(s.rule)}</span>
                  {next && <span>próxima: {fmtDateTime(next.getTime())}</span>}
                </div>
              </li>
            )
          })}
        </ul>
      </aside>
    </div>
  )
}
