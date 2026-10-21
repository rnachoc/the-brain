import { CalendarClock, Pause, Play, Plus, Trash2, Zap } from 'lucide-react'
import { useState } from 'react'
import { useStore } from '../store'
import type { ScheduleRule } from '../types'
import { cx, describeRule, fmtDateTime, nextOccurrence } from '../util'
import { ProjectTag } from './bits'

const DAYS = [
  [1, 'L'],
  [2, 'M'],
  [3, 'X'],
  [4, 'J'],
  [5, 'V'],
  [6, 'S'],
  [0, 'D'],
] as const

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cx('relative h-5 w-9 shrink-0 rounded-full transition', on ? 'bg-emerald-500/80' : 'bg-white/10')}
    >
      <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', on ? 'left-[18px]' : 'left-0.5')} />
    </button>
  )
}

function NewSchedule({ onDone }: { onDone: () => void }) {
  const projects = useStore((s) => s.projects)
  const create = useStore((s) => s.createSchedule)
  const [projectId, setProjectId] = useState(projects.find((p) => !p.fallback)?.id ?? projects[0]?.id)
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [type, setType] = useState<ScheduleRule['type']>('weekly')
  const [weekdays, setWeekdays] = useState<number[]>([1])
  const [time, setTime] = useState('09:00')
  const [at, setAt] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const rule: ScheduleRule =
      type === 'daily' ? { type, time } : type === 'weekly' ? { type, weekdays, time } : { type, at: at ? new Date(at).toISOString() : '' }
    const err = await create({ projectId, title, prompt, rule })
    if (err) setError(err)
    else onDone()
  }

  const field = 'w-full rounded-lg bg-white/[0.04] px-3 py-2 text-[13px] text-slate-100 ring-1 ring-inset ring-white/[0.08] placeholder:text-slate-500 focus:outline-none focus:ring-violet-400/50'

  return (
    <div className="space-y-2.5 rounded-xl border border-violet-400/20 bg-violet-500/[0.04] p-3.5">
      <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={cx(field, 'hq-select')}>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título (p. ej. Ofertas nuevas)" className={field} />
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={2}
        placeholder="Orden para el agente (p. ej. Revisa ofertas remotas nuevas y resume las 5 mejores)"
        className={cx(field, 'resize-none')}
      />
      <div className="flex gap-1 rounded-lg bg-white/[0.03] p-0.5 ring-1 ring-inset ring-white/[0.06]">
        {(
          [
            ['daily', 'Cada día'],
            ['weekly', 'Semanal'],
            ['once', 'Una vez'],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setType(k)}
            className={cx('flex-1 rounded-md py-1.5 text-[12px] font-medium', type === k ? 'bg-white/[0.09] text-white' : 'text-slate-400 hover:text-slate-200')}
          >
            {l}
          </button>
        ))}
      </div>
      {type === 'weekly' && (
        <div className="flex gap-1">
          {DAYS.map(([d, l]) => (
            <button
              key={d}
              onClick={() => setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d]))}
              className={cx(
                'h-8 flex-1 rounded-md text-[12px] font-semibold ring-1 ring-inset',
                weekdays.includes(d) ? 'bg-violet-500/20 text-violet-100 ring-violet-400/40' : 'text-slate-500 ring-white/[0.08] hover:text-slate-300',
              )}
            >
              {l}
            </button>
          ))}
        </div>
      )}
      {type === 'once' ? (
        <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className={field} />
      ) : (
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} />
      )}
      {error && <div className="text-[12px] text-rose-300">{error}</div>}
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onDone} className="btn btn-ghost btn-sm">
          Cancelar
        </button>
        <button onClick={submit} className="btn btn-sm bg-violet-500 text-white hover:bg-violet-400">
          <Plus size={13} /> Crear
        </button>
      </div>
    </div>
  )
}

export function SchedulesPanel() {
  const schedules = useStore((s) => s.schedules)
  const paused = useStore((s) => s.schedulesPaused)
  const setPaused = useStore((s) => s.setSchedulesPaused)
  const select = useStore((s) => s.selectProject)
  const toggle = useStore((s) => s.toggleSchedule)
  const remove = useStore((s) => s.deleteSchedule)
  const runNow = useStore((s) => s.runScheduleNow)
  const [adding, setAdding] = useState(false)

  return (
    <aside>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-white">Programadas</h2>
        <button onClick={() => setAdding(true)} className="btn btn-ghost btn-sm ml-auto">
          <Plus size={13} /> Nueva
        </button>
      </div>

      <div
        className={cx(
          'mb-3 flex items-center gap-3 rounded-xl px-3.5 py-2.5 ring-1 ring-inset',
          paused ? 'bg-amber-400/[0.06] ring-amber-400/20' : 'bg-white/[0.02] ring-white/[0.06]',
        )}
      >
        {paused ? <Pause size={15} className="text-amber-300" /> : <Play size={15} className="text-emerald-300" />}
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-slate-100">{paused ? 'Todas en pausa' : 'Programadas activas'}</div>
          <div className="text-[11px] text-slate-500">Cada ejecución usa tu plan de Claude.</div>
        </div>
        <Toggle on={!paused} onClick={() => setPaused(!paused)} label={paused ? 'Reanudar todas' : 'Pausar todas'} />
      </div>

      {adding && (
        <div className="mb-3">
          <NewSchedule onDone={() => setAdding(false)} />
        </div>
      )}

      <ul className="space-y-2">
        {schedules.length === 0 && !adding && (
          <li className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/[0.08] px-4 py-8 text-center">
            <CalendarClock size={20} className="text-slate-500" />
            <span className="text-[13px] text-slate-400">No hay tareas programadas.</span>
            <span className="text-[11px] text-slate-500">Crea una para que un agente trabaje solo a su hora.</span>
          </li>
        )}
        {schedules.map((s) => {
          const next = s.enabled && !paused ? nextOccurrence(s.rule) : null
          return (
            <li key={s.id} className={cx('rounded-xl border border-white/[0.06] bg-hq-panel/70 p-3', (!s.enabled || paused) && 'opacity-60')}>
              <div className="flex items-center gap-2">
                <ProjectTag id={s.projectId} onClick={() => select(s.projectId)} />
                <div className="ml-auto flex items-center gap-1">
                  <button onClick={() => runNow(s.id)} title="Ejecutar ahora" className="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-white">
                    <Zap size={14} />
                  </button>
                  <button
                    onClick={() => window.confirm(`¿Borrar la programación "${s.title}"?`) && remove(s.id)}
                    title="Borrar"
                    className="rounded-md p-1.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-300"
                  >
                    <Trash2 size={14} />
                  </button>
                  <Toggle on={s.enabled} onClick={() => toggle(s.id)} label={s.enabled ? 'Desactivar' : 'Activar'} />
                </div>
              </div>
              <div className="mt-2 text-[13px] font-medium text-slate-100">{s.title}</div>
              <div className="text-[12px] leading-snug text-slate-400">{s.prompt}</div>
              <div className="mt-2 flex flex-wrap justify-between gap-x-3 text-[11px] text-slate-500">
                <span>{describeRule(s.rule)}</span>
                {next ? <span>próxima: {fmtDateTime(next.getTime())}</span> : s.lastRunAt ? <span>última: {fmtDateTime(s.lastRunAt)}</span> : null}
              </div>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
