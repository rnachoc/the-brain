import { agentStatus, useStore } from '../store'
import type { Tab } from '../types'
import { cx } from '../util'

const TABS: { id: Tab; label: string }[] = [
  { id: 'office', label: 'Office' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'brain', label: 'Brain' },
]

export function TopBar() {
  const tab = useStore((s) => s.tab)
  const setTab = useStore((s) => s.setTab)
  const totalAgents = useStore((s) => s.projects.reduce((n, p) => n + p.agents, 0))
  const running = useStore((s) => s.projects.filter((p) => agentStatus(s, p.id) !== 'idle').reduce((n, p) => n + p.agents, 0))
  const approvals = useStore((s) => s.orders.filter((o) => o.status === 'awaiting_approval').length)
  const connected = useStore((s) => s.connected)
  const live = useStore((s) => s.live)

  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center gap-6 border-b border-white/5 bg-hq-bg/70 px-5 backdrop-blur">
      <div className="flex items-center gap-2.5">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400 text-base shadow-lg shadow-violet-500/30">
          🧠
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-bold tracking-tight text-white">The Brain</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">orquestador</div>
        </div>
      </div>

      <nav className="flex gap-1 rounded-lg bg-white/[0.03] p-1 ring-1 ring-white/5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cx(
              'rounded-md px-3.5 py-1.5 text-sm font-medium transition',
              tab === t.id ? 'bg-white/10 text-white shadow' : 'text-slate-400 hover:text-slate-200',
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-4 whitespace-nowrap text-sm">
        {!connected ? (
          <span className="rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-300 ring-1 ring-rose-400/30">
            Sin conexión con el servidor
          </span>
        ) : (
          <span
            title={live ? 'Router con Claude y agentes reales en los proyectos live' : 'Añade ANTHROPIC_API_KEY en .env para usar Claude'}
            className={cx(
              'rounded-full px-2.5 py-1 text-xs font-medium ring-1',
              live ? 'bg-violet-500/10 text-violet-200 ring-violet-400/30' : 'bg-white/5 text-slate-400 ring-white/10',
            )}
          >
            {live ? 'Claude conectado' : 'Modo simulado'}
          </span>
        )}
        {approvals > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-medium text-amber-300 ring-1 ring-amber-400/30">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
            {approvals} por aprobar
          </span>
        )}
        <span className="flex items-center gap-2 text-slate-300">
          <span className={cx('h-2 w-2 rounded-full', running ? 'animate-pulse bg-emerald-400' : 'bg-slate-500')} />
          <b className="text-white">{totalAgents}</b> agentes · <b className="text-white">{running}</b> corriendo
        </span>
      </div>
    </header>
  )
}
