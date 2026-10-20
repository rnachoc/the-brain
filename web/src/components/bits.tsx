import { useState } from 'react'
import { projectById } from '../config'
import { useStore } from '../store'
import type { Draft, Order, OrderStatus } from '../types'
import { cx, ORDER_META } from '../util'

export function StatusChip({ status, className }: { status: OrderStatus; className?: string }) {
  const m = ORDER_META[status]
  return (
    <span className={cx('inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1', m.cls, className)}>
      <span className={cx('h-1.5 w-1.5 rounded-full', m.dot)} />
      {m.label}
    </span>
  )
}

export function ProjectTag({ id, onClick }: { id: string; onClick?: () => void }) {
  const p = projectById(id)
  return (
    <button
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset hover:brightness-125"
      style={{ color: p.color, background: `${p.color}14`, boxShadow: `inset 0 0 0 1px ${p.color}33` }}
    >
      <span>{p.icon}</span>
      {p.name}
    </button>
  )
}

const KIND_LABEL: Record<Draft['kind'], string> = {
  email: 'Email',
  message: 'Mensaje',
  post: 'Publicación',
  payment: 'Pago',
  other: 'Borrador',
}

/** Borrador de una orden externa con botones Aprobar / Rechazar. */
export function DraftCard({ order }: { order: Order }) {
  const approve = useStore((s) => s.approve)
  const reject = useStore((s) => s.reject)
  const [copied, setCopied] = useState(false)
  const d = order.draft
  if (!d) return null
  const pending = order.status === 'awaiting_approval'

  const copy = async () => {
    await navigator.clipboard.writeText(d.subject ? `${d.subject}\n\n${d.body}` : d.body)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className={cx('rounded-lg border p-3', pending ? 'border-amber-400/30 bg-amber-400/5' : 'border-hq-line bg-black/20')}>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
        <span className="rounded bg-white/5 px-1.5 py-0.5 font-medium text-slate-300">{KIND_LABEL[d.kind]}</span>
        {d.to && (
          <span>
            Para: <span className="text-slate-200">{d.to}</span>
          </span>
        )}
        {d.subject && (
          <span>
            Asunto: <span className="text-slate-200">{d.subject}</span>
          </span>
        )}
      </div>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-slate-200">{d.body}</pre>
      <div className="mt-3 flex items-center gap-2">
        {pending ? (
          <>
            <button
              onClick={() => approve(order.id)}
              className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-400"
            >
              Aprobar
            </button>
            <button
              onClick={() => reject(order.id)}
              className="rounded-md bg-white/5 px-3 py-1.5 text-xs font-semibold text-rose-300 ring-1 ring-rose-400/30 hover:bg-rose-500/10"
            >
              Rechazar
            </button>
            <span className="ml-auto text-[11px] text-slate-500">Nada se envía solo: aprobar deja el borrador listo.</span>
          </>
        ) : (
          <button onClick={copy} className="rounded-md bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10">
            {copied ? '¡Copiado!' : 'Copiar borrador'}
          </button>
        )}
      </div>
    </div>
  )
}
