// Automatizaciones: programadas de The Brain, tareas de Claude Desktop (solo lectura) y señales de proyecto.
import { ChevronDown, ChevronRight, FileText, Radio, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ProjectTag } from '../components/bits'
import { SchedulesPanel } from '../components/SchedulesPanel'
import { useStore } from '../store'
import type { ClaudeTask, ProjectSignal } from '../types'
import { cx, fmtDateTime } from '../util'

const TONE = { ok: 'bg-emerald-400', warn: 'bg-[#F5B800]', error: 'bg-rose-400' }

function Section({ title, hint, children, action }: { title: string; hint?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-end gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {hint && <p className="text-[12px] text-slate-500">{hint}</p>}
        </div>
        <div className="ml-auto">{action}</div>
      </div>
      {children}
    </section>
  )
}

function ClaudeTaskRow({ t }: { t: ClaudeTask }) {
  const [open, setOpen] = useState(false)
  return (
    <li className="rounded-xl border border-white/[0.06] bg-hq-panel/70">
      <button onClick={() => setOpen(!open)} className="flex w-full items-start gap-2.5 px-3.5 py-3 text-left">
        {open ? <ChevronDown size={15} className="mt-0.5 shrink-0 text-slate-500" /> : <ChevronRight size={15} className="mt-0.5 shrink-0 text-slate-500" />}
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-slate-100">{t.name}</div>
          {t.description && <div className="text-[12px] leading-snug text-slate-400">{t.description}</div>}
        </div>
        <span className="shrink-0 text-[11px] text-slate-500">editada {fmtDateTime(t.updatedAt)}</span>
      </button>
      {open && <pre className="max-h-80 overflow-auto whitespace-pre-wrap border-t border-white/[0.06] px-4 py-3 font-mono text-[12px] leading-relaxed text-slate-300">{t.body}</pre>}
    </li>
  )
}

export function SignalCard({ projectId, signal }: { projectId: string; signal: ProjectSignal }) {
  const [report, setReport] = useState<string | null>(null)
  const file = (path: string) => `/api/projects/${projectId}/file?path=${encodeURIComponent(path)}`
  const toggleReport = async () => {
    if (report !== null) return setReport(null)
    const r = await fetch(file(signal.report!))
    setReport(r.ok ? await r.text() : 'No se pudo abrir el informe.')
  }
  return (
    <div className="rounded-xl border border-white/[0.06] bg-hq-panel/70 p-3.5">
      <div className="flex items-center gap-2">
        <span className={cx('h-2 w-2 shrink-0 rounded-full', TONE[signal.tone])} />
        <div className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-100">{signal.headline || 'Sin titular'}</div>
        <span className="shrink-0 text-[11px] text-slate-500">{fmtDateTime(signal.mtime)}</span>
      </div>
      <div className="mt-2.5 flex gap-3">
        {signal.image && <img src={file(signal.image)} alt="" className="h-24 w-16 shrink-0 rounded-md object-cover ring-1 ring-white/10" />}
        {signal.items.length > 0 && (
          <dl className="grid flex-1 grid-cols-2 gap-2">
            {signal.items.map((it) => (
              <div key={it.label} className="rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                <dt className="truncate text-[11px] text-slate-500">{it.label}</dt>
                <dd className="text-[13px] font-semibold text-white">
                  {it.value} {it.delta && <span className="text-[11px] font-medium text-emerald-300">{it.delta}</span>}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      {signal.report && (
        <button onClick={toggleReport} className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-white">
          <FileText size={13} /> {report === null ? 'Ver informe' : 'Ocultar informe'}
        </button>
      )}
      {report !== null && <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-black/20 p-3 font-sans text-[12px] leading-relaxed text-slate-300">{report}</pre>}
    </div>
  )
}

export function AutomationsView() {
  const signals = useStore((s) => s.signals)
  const select = useStore((s) => s.selectProject)
  const [tasks, setTasks] = useState<ClaudeTask[] | null>(null)

  const load = () =>
    fetch('/api/automations/claude')
      .then((r) => (r.ok ? r.json() : []))
      .then(setTasks, () => setTasks([]))
  useEffect(() => {
    void load()
  }, [])

  const signalList = Object.entries(signals)

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-10 p-6">
        <SchedulesPanel />

        <Section
          title="Tareas programadas de Claude"
          hint="Solo lectura. Se gestionan desde la app de Claude."
          action={
            <button onClick={load} className="btn btn-ghost btn-sm">
              <RefreshCw size={13} /> Actualizar
            </button>
          }
        >
          {tasks === null ? (
            <p className="text-[13px] text-slate-500">Cargando…</p>
          ) : tasks.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/[0.08] px-4 py-6 text-center text-[13px] text-slate-500">No hay tareas programadas de Claude en esta máquina.</p>
          ) : (
            <ul className="space-y-2">
              {tasks.map((t) => (
                <ClaudeTaskRow key={t.id} t={t} />
              ))}
            </ul>
          )}
        </Section>

        <Section title="Señales de proyecto" hint="Lo que cada proyecto escribe en .brain/status.json. Se revisa cada minuto.">
          {signalList.length === 0 ? (
            <p className="flex items-center gap-2 rounded-xl border border-dashed border-white/[0.08] px-4 py-6 text-[13px] text-slate-500">
              <Radio size={15} /> Ningún proyecto ha publicado una señal todavía.
            </p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {signalList.map(([id, sig]) => (
                <div key={id}>
                  <div className="mb-1.5">
                    <ProjectTag id={id} onClick={() => select(id)} />
                  </div>
                  <SignalCard projectId={id} signal={sig} />
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}
