import { BrainCircuit, CalendarDays, LayoutGrid, ListChecks, type LucideIcon } from 'lucide-react'
import { agentStatus, useStore } from '../store'
import type { Tab } from '../types'
import { cx } from '../util'
import { BrainMark } from './icons'

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'office', label: 'Office', icon: LayoutGrid },
  { id: 'tasks', label: 'Tasks', icon: ListChecks },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'brain', label: 'Brain', icon: BrainCircuit },
]

function Stat({ value, label, tone }: { value: number; label: string; tone?: 'live' | 'warn' }) {
  return (
    <div className="flex items-baseline gap-1.5 px-3">
      <span
        className={cx(
          'text-[15px] font-semibold tabular-nums',
          tone === 'live' ? 'text-emerald-300' : tone === 'warn' ? 'text-amber-300' : 'text-white',
        )}
      >
        {value}
      </span>
      <span className="text-[11px] text-slate-500">{label}</span>
    </div>
  )
}

export function TopBar() {
  const tab = useStore((s) => s.tab)
  const setTab = useStore((s) => s.setTab)
  const totalAgents = useStore((s) => s.projects.reduce((n, p) => n + p.agents, 0))
  const running = useStore((s) => s.projects.filter((p) => agentStatus(s, p.id) !== 'idle').reduce((n, p) => n + p.agents, 0))
  const approvals = useStore((s) => s.orders.filter((o) => o.status === 'awaiting_approval').length)
  const connected = useStore((s) => s.connected)
  const live = useStore((s) => s.live)

  const mode = !connected
    ? { label: 'Sin conexión', dot: 'bg-rose-400', cls: 'text-rose-200 ring-rose-400/25 bg-rose-500/[0.08]', hint: 'El servidor de agentes no responde' }
    : live
      ? { label: 'Claude conectado', dot: 'bg-violet-400', cls: 'text-violet-100 ring-violet-400/25 bg-violet-500/[0.08]', hint: 'Router con Claude y agentes reales en los proyectos live' }
      : { label: 'Modo simulado', dot: 'bg-slate-400', cls: 'text-slate-300 ring-white/10 bg-white/[0.03]', hint: 'Ejecuta "npm run login" y pega el token en .env para usar Claude' }

  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center gap-6 border-b border-white/[0.06] bg-hq-bg/80 px-5 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <BrainMark size={30} />
        <div className="leading-none">
          <div className="text-[15px] font-semibold tracking-[-0.01em] text-white">The Brain</div>
          <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">Agent control room</div>
        </div>
      </div>

      <nav className="flex items-center gap-0.5 rounded-lg bg-white/[0.03] p-0.5 ring-1 ring-inset ring-white/[0.06]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cx(
              'flex h-8 items-center gap-2 rounded-md px-3 text-[13px] font-medium transition-colors',
              tab === t.id ? 'bg-white/[0.09] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]' : 'text-slate-400 hover:text-slate-200',
            )}
          >
            <t.icon size={15} strokeWidth={2} className={tab === t.id ? 'text-violet-300' : ''} />
            {t.label}
          </button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-3 whitespace-nowrap">
        <span title={mode.hint} className={cx('inline-flex h-7 items-center gap-2 rounded-full px-3 text-[11px] font-medium ring-1 ring-inset', mode.cls)}>
          <span className={cx('h-1.5 w-1.5 rounded-full', mode.dot, connected && live && 'animate-pulse')} />
          {mode.label}
        </span>
        <div className="flex h-8 items-center divide-x divide-white/[0.06] rounded-lg bg-white/[0.02] ring-1 ring-inset ring-white/[0.06]">
          <Stat value={totalAgents} label="agentes" />
          <Stat value={running} label="corriendo" tone={running ? 'live' : undefined} />
          <Stat value={approvals} label="por aprobar" tone={approvals ? 'warn' : undefined} />
        </div>
      </div>
    </header>
  )
}
