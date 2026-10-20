import type { AgentStatus, OrderStatus, ScheduleRule } from './types'

export const uid = () => Math.random().toString(36).slice(2, 10)

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const rand = (a: number, b: number) => a + Math.random() * (b - a)

export function timeAgo(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 10) return 'ahora'
  if (s < 60) return `hace ${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `hace ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.round(h / 24)} d`
}

export const fmtTime = (ts: number) =>
  new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

export const fmtDateTime = (ts: number) =>
  new Date(ts).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export const ORDER_META: Record<OrderStatus, { label: string; cls: string; dot: string }> = {
  pending: { label: 'Pendiente', cls: 'bg-slate-500/15 text-slate-300 ring-slate-400/25', dot: 'bg-slate-400' },
  running: { label: 'En curso', cls: 'bg-sky-500/15 text-sky-300 ring-sky-400/30', dot: 'bg-sky-400 animate-pulse' },
  awaiting_approval: {
    label: 'Necesita aprobación',
    cls: 'bg-amber-500/15 text-amber-300 ring-amber-400/30',
    dot: 'bg-amber-400 animate-pulse',
  },
  done: { label: 'Hecha', cls: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30', dot: 'bg-emerald-400' },
  rejected: { label: 'Rechazada', cls: 'bg-rose-500/15 text-rose-300 ring-rose-400/30', dot: 'bg-rose-400' },
  failed: { label: 'Fallida', cls: 'bg-red-500/15 text-red-300 ring-red-400/30', dot: 'bg-red-500' },
}

export const AGENT_META: Record<AgentStatus, { label: string; color: string }> = {
  idle: { label: 'idle', color: '#64748b' },
  running: { label: 'running', color: '#22c55e' },
  waiting: { label: 'waiting', color: '#f59e0b' },
}

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

export function describeRule(rule: ScheduleRule): string {
  switch (rule.type) {
    case 'daily':
      return `Cada día · ${rule.time}`
    case 'weekly':
      return `${rule.weekdays.map((d) => WEEKDAYS[d]).join(', ')} · ${rule.time}`
    case 'once':
      return `Una vez · ${fmtDateTime(new Date(rule.at).getTime())}`
  }
}

export function ruleMatchesDay(rule: ScheduleRule, day: Date): boolean {
  switch (rule.type) {
    case 'daily':
      return true
    case 'weekly':
      return rule.weekdays.includes(day.getDay())
    case 'once':
      return new Date(rule.at).toDateString() === day.toDateString()
  }
}

export function nextOccurrence(rule: ScheduleRule, from = new Date()): Date | null {
  if (rule.type === 'once') {
    const d = new Date(rule.at)
    return d > from ? d : null
  }
  const [hh, mm] = rule.time.split(':').map(Number)
  for (let i = 0; i < 8; i++) {
    const d = new Date(from)
    d.setDate(d.getDate() + i)
    d.setHours(hh, mm, 0, 0)
    if (d > from && ruleMatchesDay(rule, d)) return d
  }
  return null
}
