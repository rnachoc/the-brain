// Sin WebGL: lista de empleados con las mismas acciones (tarjeta, filtros, jefa de gabinete).
import { agentStatus, employeeLine, useStore } from '../store'
import type { Project } from '../types'
import { cx } from '../util'
import { AgentCard } from './hud/AgentCard'
import { ChiefLine } from './hud/ChiefLine'
import { Filters } from './hud/Filters'
import { employeeName, employeeRole } from './look'
import { useOffice } from './state'

const DOT = { running: 'bg-emerald-400', waiting: 'bg-[#F5B800]', idle: 'bg-slate-500' }

function Row({ p }: { p: Project }) {
  const status = useStore((s) => agentStatus(s, p.id))
  const line = useStore((s) => employeeLine(s, p.id))
  const selected = useStore((s) => s.selectedProjectId === p.id)
  const select = useStore((s) => s.selectProject)
  const filter = useOffice((s) => s.filter)
  return (
    <button
      onClick={() => select(p.id)}
      className={cx(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left ring-1 ring-inset transition-colors',
        selected ? 'bg-white/[0.08] ring-[#F5B800]/40' : 'bg-white/[0.03] ring-white/[0.06] hover:bg-white/[0.06]',
        filter !== 'all' && filter !== status && 'opacity-40',
      )}
    >
      <span className={cx('h-2 w-2 shrink-0 rounded-full', DOT[status])} />
      <span className="w-40 shrink-0">
        <span className="block truncate text-[13px] font-semibold text-white">{employeeName(p)}</span>
        <span className="block truncate text-[11px] text-[#F5B800]">{employeeRole(p)}</span>
      </span>
      <span className="min-w-0 flex-1 truncate text-[12px] text-slate-400">{line}</span>
    </button>
  )
}

export function Fallback({ onOverview }: { onOverview: () => void }) {
  const projects = useStore((s) => s.projects)
  const selected = useStore((s) => s.selectedProjectId)
  const select = useStore((s) => s.selectProject)
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 overflow-y-auto px-4 pb-32 pt-4">
        <div className="mx-auto max-w-2xl">
          <p className="mb-3 rounded-lg bg-white/[0.03] px-3 py-2 text-[12px] text-slate-400 ring-1 ring-inset ring-white/[0.06]">
            Este navegador no tiene WebGL activo, así que la oficina se muestra como lista.
          </p>
          <div className="space-y-1.5">
            {projects.map((p) => (
              <Row key={p.id} p={p} />
            ))}
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-4 left-4 z-10 flex flex-col items-start gap-2">
        {selected && <AgentCard key={selected} projectId={selected} onClose={() => select(null)} />}
        <Filters onOverview={onOverview} />
      </div>
      <div className="pointer-events-none absolute bottom-16 left-1/2 z-10 -translate-x-1/2">
        <ChiefLine />
      </div>
    </div>
  )
}
