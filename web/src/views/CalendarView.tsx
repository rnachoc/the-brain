import { useMemo, useState } from 'react'
import { projectById } from '../config'
import { useStore } from '../store'
import { cx, ruleMatchesDay } from '../util'

const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

interface Item {
  projectId: string
  label: string
  time?: string
  kind: 'scheduled' | 'run'
}

export function CalendarView() {
  const schedules = useStore((s) => s.schedules)
  const runs = useStore((s) => s.runs)
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selected, setSelected] = useState(() => new Date().toDateString())

  const days = useMemo(() => {
    const first = new Date(cursor)
    const offset = (first.getDay() + 6) % 7 // semana empieza en lunes
    const start = new Date(first)
    start.setDate(1 - offset)
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [cursor])

  const itemsFor = (d: Date): Item[] => {
    const out: Item[] = []
    for (const s of schedules) {
      if (!s.enabled || !ruleMatchesDay(s.rule, d)) continue
      const time = s.rule.type === 'once' ? new Date(s.rule.at).toTimeString().slice(0, 5) : s.rule.time
      out.push({ projectId: s.projectId, label: s.title, time, kind: 'scheduled' })
    }
    for (const r of runs) {
      if (new Date(r.startedAt).toDateString() === d.toDateString())
        out.push({ projectId: r.projectId, label: r.prompt, time: new Date(r.startedAt).toTimeString().slice(0, 5), kind: 'run' })
    }
    return out.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
  }

  const today = new Date().toDateString()
  const month = cursor.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  const selectedItems = itemsFor(new Date(selected))
  const shift = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1))

  return (
    <div className="mx-auto grid h-full max-w-7xl gap-6 overflow-y-auto p-6 lg:grid-cols-[1fr_320px]">
      <section>
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-lg font-semibold capitalize text-white">{month}</h2>
          <div className="ml-auto flex gap-1">
            <button onClick={() => shift(-1)} className="hq-btn">‹</button>
            <button
              onClick={() => {
                const d = new Date()
                setCursor(new Date(d.getFullYear(), d.getMonth(), 1))
                setSelected(d.toDateString())
              }}
              className="hq-btn"
            >
              Hoy
            </button>
            <button onClick={() => shift(1)} className="hq-btn">›</button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-white/5 bg-white/5">
          {DOW.map((d) => (
            <div key={d} className="bg-hq-panel px-2 py-1.5 text-center text-[11px] uppercase tracking-wider text-slate-500">
              {d}
            </div>
          ))}
          {days.map((d) => {
            const items = itemsFor(d)
            const inMonth = d.getMonth() === cursor.getMonth()
            const key = d.toDateString()
            return (
              <button
                key={key}
                onClick={() => setSelected(key)}
                className={cx(
                  'flex min-h-[92px] flex-col gap-1 bg-hq-panel/90 p-1.5 text-left transition hover:bg-hq-card',
                  !inMonth && 'opacity-40',
                  selected === key && 'ring-1 ring-inset ring-violet-400/60',
                )}
              >
                <span className={cx('grid h-6 w-6 place-items-center rounded-full text-xs', key === today ? 'bg-violet-500 font-semibold text-white' : 'text-slate-400')}>
                  {d.getDate()}
                </span>
                {items.slice(0, 3).map((it, i) => {
                  const p = projectById(it.projectId)
                  return (
                    <span
                      key={i}
                      className={cx('truncate rounded px-1 py-px text-[10px]', it.kind === 'run' && 'opacity-60')}
                      style={{ color: p.color, background: `${p.color}17` }}
                    >
                      {it.kind === 'scheduled' ? '⏰' : '✓'} {it.time} {it.label}
                    </span>
                  )
                })}
                {items.length > 3 && <span className="text-[10px] text-slate-500">+{items.length - 3} más</span>}
              </button>
            )
          })}
        </div>
      </section>

      <aside>
        <h2 className="mb-4 text-lg font-semibold capitalize text-white">
          {new Date(selected).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        </h2>
        <ul className="space-y-2">
          {selectedItems.length === 0 && <li className="text-sm text-slate-500">Nada este día.</li>}
          {selectedItems.map((it, i) => {
            const p = projectById(it.projectId)
            return (
              <li key={i} className="flex gap-3 rounded-xl border border-white/5 bg-hq-panel/70 p-3">
                <div className="w-11 shrink-0 font-mono text-xs text-slate-400">{it.time}</div>
                <div className="min-w-0">
                  <div className="text-sm text-slate-100">{it.label}</div>
                  <div className="mt-0.5 text-[11px]" style={{ color: p.color }}>
                    {p.icon} {p.name} · {it.kind === 'scheduled' ? 'programada' : 'ejecutada'}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </aside>
    </div>
  )
}
