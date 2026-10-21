import { Check, ChevronDown, ChevronUp, FileText, X } from 'lucide-react'
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
  const waiting = o.status === 'awaiting_approval'

  return (
    <li className={cx('rounded-lg', waiting && 'bg-amber-400/[0.05] ring-1 ring-inset ring-amber-400/15')}>
      <div className="grid grid-cols-[180px_minmax(0,1fr)_auto] items-center gap-4 px-3 py-1.5 hover:bg-white/[0.02]">
        <ProjectTag id={o.projectId} onClick={() => select(o.projectId)} />
        <div className="flex min-w-0 items-center gap-2">
          <span className={cx('truncate text-[13px]', o.status === 'done' || o.status === 'rejected' ? 'text-slate-500' : 'text-slate-100')}>
            {o.title}
          </span>
          {o.draft && (
            <button
              onClick={() => setOpen(!open)}
              className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-slate-400 hover:bg-white/5 hover:text-white"
            >
              <FileText size={12} /> {open ? 'Ocultar' : 'Borrador'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {waiting && (
            <>
              <button onClick={() => approve(o.id)} className="btn btn-approve btn-sm">
                <Check size={13} strokeWidth={2.6} /> Aprobar
              </button>
              <button onClick={() => reject(o.id)} className="btn btn-ghost-danger btn-sm">
                <X size={13} strokeWidth={2.6} /> Rechazar
              </button>
            </>
          )}
          <span className="hidden w-16 text-right text-[11px] tabular-nums text-slate-500 md:inline">{timeAgo(o.updatedAt)}</span>
          <StatusChip status={o.status} className="w-[150px] justify-start" />
        </div>
      </div>
      {open && o.draft && (
        <div className="px-3 pb-3">
          <DraftCard order={o} />
        </div>
      )}
    </li>
  )
}

function Count({ n, label, cls }: { n: number; label: string; cls: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
      <span className={cx('h-1.5 w-1.5 rounded-full', cls)} />
      <span className="tabular-nums text-slate-300">{n}</span> {label}
    </span>
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
    <section className="border-t border-white/[0.06] bg-hq-panel/90 backdrop-blur-xl">
      <button onClick={() => setCollapsed(!collapsed)} className="flex h-10 w-full items-center gap-5 px-5 text-left">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">Cola de órdenes</span>
        <Count n={counts.running} label="en curso" cls="bg-sky-400" />
        <Count n={counts.pending} label="pendientes" cls="bg-slate-400" />
        <Count n={counts.approval} label="por aprobar" cls={counts.approval ? 'bg-amber-400 animate-pulse' : 'bg-amber-400/40'} />
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300">
          {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {collapsed ? 'Mostrar' : 'Ocultar'}
        </span>
      </button>
      {!collapsed && (
        <ul className="max-h-[24vh] space-y-0.5 overflow-y-auto px-2 pb-2">
          {list.length === 0 && <li className="px-3 py-3 text-[13px] text-slate-500">Sin órdenes todavía. Escribe abajo lo que necesitas.</li>}
          {list.map((o) => (
            <Row key={o.id} o={o} />
          ))}
        </ul>
      )}
    </section>
  )
}
