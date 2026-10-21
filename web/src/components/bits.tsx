import { Check, CircleAlert, CircleCheck, CircleDashed, Copy, LoaderCircle, Mail, Megaphone, MessageSquare, CreditCard, FileText, X, XCircle, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { projectById } from '../config'
import { useStore } from '../store'
import type { Draft, Order, OrderStatus } from '../types'
import { cx, ORDER_META } from '../util'
import { ProjectIcon } from './icons'

const STATUS_ICON: Record<OrderStatus, LucideIcon> = {
  pending: CircleDashed,
  running: LoaderCircle,
  awaiting_approval: CircleAlert,
  done: CircleCheck,
  rejected: XCircle,
  failed: XCircle,
}

export function StatusChip({ status, className }: { status: OrderStatus; className?: string }) {
  const m = ORDER_META[status]
  const Icon = STATUS_ICON[status]
  return (
    <span
      className={cx(
        'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium ring-1 ring-inset',
        m.cls,
        className,
      )}
    >
      <Icon size={12} strokeWidth={2.4} className={cx(status === 'running' && 'animate-spin')} />
      {m.label}
    </span>
  )
}

export function ProjectTag({ id, onClick }: { id: string; onClick?: () => void }) {
  const p = projectById(id)
  return (
    <button
      onClick={onClick}
      className="group inline-flex min-w-0 shrink-0 items-center gap-2 rounded-md py-0.5 pr-1.5 text-left text-[12px] font-medium text-slate-300 hover:text-white"
    >
      <ProjectIcon icon={p.icon} color={p.color} size="sm" />
      <span className="truncate">{p.name}</span>
    </button>
  )
}

const KIND: Record<Draft['kind'], { label: string; icon: LucideIcon }> = {
  email: { label: 'Email', icon: Mail },
  message: { label: 'Mensaje', icon: MessageSquare },
  post: { label: 'Publicación', icon: Megaphone },
  payment: { label: 'Pago', icon: CreditCard },
  other: { label: 'Borrador', icon: FileText },
}

/** Borrador de una orden externa con botones Aprobar / Rechazar. */
export function DraftCard({ order }: { order: Order }) {
  const approve = useStore((s) => s.approve)
  const reject = useStore((s) => s.reject)
  const [copied, setCopied] = useState(false)
  const d = order.draft
  if (!d) return null
  const pending = order.status === 'awaiting_approval'
  const kind = KIND[d.kind]

  const copy = async () => {
    await navigator.clipboard.writeText(d.subject ? `${d.subject}\n\n${d.body}` : d.body)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className={cx('overflow-hidden rounded-xl border', pending ? 'border-amber-400/25 bg-amber-400/[0.04]' : 'border-white/[0.07] bg-white/[0.02]')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/[0.06] px-3.5 py-2 text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1.5 font-medium text-slate-200">
          <kind.icon size={13} strokeWidth={2.2} />
          {kind.label}
        </span>
        {d.to && (
          <span>
            Para <span className="text-slate-200">{d.to}</span>
          </span>
        )}
        {d.subject && (
          <span className="truncate">
            Asunto <span className="text-slate-200">{d.subject}</span>
          </span>
        )}
      </div>
      <pre className="max-h-52 overflow-auto whitespace-pre-wrap px-3.5 py-3 font-sans text-[13px] leading-relaxed text-slate-200">{d.body}</pre>
      <div className="flex items-center gap-2 border-t border-white/[0.06] px-3.5 py-2.5">
        {pending ? (
          <>
            <button onClick={() => approve(order.id)} className="btn btn-approve">
              <Check size={14} strokeWidth={2.6} /> Aprobar
            </button>
            <button onClick={() => reject(order.id)} className="btn btn-ghost-danger">
              <X size={14} strokeWidth={2.6} /> Rechazar
            </button>
            <span className="ml-auto text-[11px] text-slate-500">Nada se envía solo · aprobar deja el borrador listo</span>
          </>
        ) : (
          <button onClick={copy} className="btn btn-ghost">
            <Copy size={13} /> {copied ? 'Copiado' : 'Copiar borrador'}
          </button>
        )}
      </div>
    </div>
  )
}
