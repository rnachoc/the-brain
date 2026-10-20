import { useMemo, useState } from 'react'
import { useStore } from '../store'
import type { Order, OrderStatus } from '../types'
import { cx, timeAgo } from '../util'
import { DraftCard, ProjectTag, StatusChip } from './bits'

const RANK: Record<OrderStatus, number> = {
  awaiting_approval: 0,
  running: 1,
  pending: 2,
  failed: 3,
  rejected: 4,
  done: 5,
}

function Row({ o }: { o: Order }) {
  const select = useStore((s) => s.selectProject)
  const approve = useStore((s) => s.approve)
  const reject = useStore((s) => s.reject)
  const [open, setOpen] = useState(false)
  const hasDraft = !!o.draft
  const waiting = o.status === 'awaiting_approval'
  return (
    <li className={cx('rounded-lg px-3 py-1.5', waiting ? 'bg-amber-400/[0.06]' : 'hover:bg-white/[0.03]')}>
      <div className="flex items-center gap-3">
        <ProjectTag id={o.projectId} onClick={() => select(o.projectId)} />
        <button
          onClick={() => hasDraft && setOpen(!open)}
          className={cx('min-w-0 flex-1 truncate text-left text-sm', o.status === 'done' ? 'text-slate-400' : 'text-slate-100', hasDraft && 'hover:underline')}
        >
          {o.title}
        </button>
        {hasDraft && (
          <button onClick={() => setOpen(!open)} className="text-[11px] text-slate-400 hover:text-white">
            {open ? 'ocultar borrador' : 'ver borrador'}
          </button>
        )}
        {waiting && (
          <>
            <button
              onClick={() => approve(o.id)}
              className="rounded-md bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-emerald-950 hover:bg-emerald-400"
            >
              Aprobar
            </button>
            <button
              onClick={() => reject(o.id)}
              className="rounded-md px-2.5 py-1 text-[11px] font-semibold text-rose-300 ring-1 ring-rose-400/30 hover:bg-rose-500/10"
            >
              Rechazar
            </button>
          </>
        )}
        <span className="hidden text-[11px] text-slate-500 sm:inline">{timeAgo(o.updatedAt)}</span>
        <StatusChip status={o.status} />
      </div>
      {open && hasDraft && (
        <div className="mt-2">
          <DraftCard order={o} />
        </div>
      )}
    </li>
  )
}

export function OrderQueue() {
  const orders = useStore((s) => s.orders)
  const [collapsed, setCollapsed] = useState(false)

  const { list, counts } = useMemo(() => {
    const active = orders.filter((o) => o.status !== 'done' && o.status !== 'rejected')
    const recentDone = orders
      .filter((o) => o.status === 'done' || o.status === 'rejected')
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 4)
    const list = [...active, ...recentDone].sort((a, b) => RANK[a.status] - RANK[b.status] || b.updatedAt - a.updatedAt)
    const counts = {
      approval: orders.filter((o) => o.status === 'awaiting_approval').length,
      running: orders.filter((o) => o.status === 'running').length,
      pending: orders.filter((o) => o.status === 'pending').length,
    }
    return { list, counts }
  }, [orders])

  return (
    <section className="border-t border-white/5 bg-hq-panel/85 backdrop-blur">
      <button onClick={() => setCollapsed(!collapsed)} className="flex w-full items-center gap-3 px-5 py-2 text-left">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Órdenes</span>
        <span className="text-xs text-slate-500">
          {counts.running} en curso · {counts.pending} pendientes
          {counts.approval > 0 && <span className="text-amber-300"> · {counts.approval} necesitan tu aprobación</span>}
        </span>
        <span className="ml-auto text-xs text-slate-500">{collapsed ? '▲ mostrar' : '▼ ocultar'}</span>
      </button>
      {!collapsed && (
        <ul className="max-h-[24vh] space-y-0.5 overflow-y-auto px-2 pb-2">
          {list.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">Sin órdenes todavía. Escribe algo abajo.</li>}
          {list.map((o) => (
            <Row key={o.id} o={o} />
          ))}
        </ul>
      )}
    </section>
  )
}
