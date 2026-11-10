// Filtros de la vista: atenúan a los que no cumplen; pulsar otra vez salta al siguiente que cumple.
import { agentStatus, useStore } from '../../store'
import { cx } from '../../util'
import { useOffice, type Filter } from '../state'

const ITEMS: { id: Exclude<Filter, 'all'>; label: string; dot: string }[] = [
  { id: 'running', label: 'Trabajando', dot: 'bg-emerald-400' },
  { id: 'waiting', label: 'Espera tu decisión', dot: 'bg-[#F5B800]' },
  { id: 'idle', label: 'Libre', dot: 'bg-slate-400' },
]

export function Filters({ onOverview }: { onOverview: () => void }) {
  const filter = useOffice((s) => s.filter)
  const setFilter = useOffice((s) => s.setFilter)
  const select = useStore((s) => s.selectProject)
  // Recuento como texto para que el selector devuelva un primitivo.
  const counts = useStore((s) => {
    const c = { running: 0, waiting: 0, idle: 0 }
    for (const p of s.projects) c[agentStatus(s, p.id)]++
    return `${c.running},${c.waiting},${c.idle}`
  })
  const [running, waiting, idle] = counts.split(',').map(Number)
  const n = { running, waiting, idle }

  const pick = (f: Exclude<Filter, 'all'>) => {
    if (filter !== f) return setFilter(f)
    const s = useStore.getState()
    const ids = s.projects.filter((p) => agentStatus(s, p.id) === f).map((p) => p.id)
    if (!ids.length) return
    const at = ids.indexOf(s.selectedProjectId ?? '')
    select(ids[(at + 1) % ids.length])
  }

  return (
    <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl bg-[#0d1017]/85 p-1 shadow-lg shadow-black/20 ring-1 ring-inset ring-white/10 backdrop-blur-md">
      <button
        onClick={() => (setFilter('all'), onOverview())}
        className={cx('h-7 rounded-lg px-2.5 text-[12px] font-medium transition-colors', filter === 'all' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white')}
      >
        Vista general
      </button>
      {ITEMS.map((it) => (
        <button
          key={it.id}
          onClick={() => pick(it.id)}
          title={filter === it.id ? 'Pulsa otra vez para ir al siguiente' : undefined}
          className={cx(
            'inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium transition-colors',
            filter === it.id ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white',
          )}
        >
          <span className={cx('h-1.5 w-1.5 rounded-full', it.dot)} />
          {it.label}
          <span className="tabular-nums text-slate-500">{n[it.id]}</span>
        </button>
      ))}
    </div>
  )
}
