// Datos de ejemplo para la fase a. Se generan a partir de los proyectos de
// config.json, así que se adaptan solos a los agentes de cada usuario.
import { projects } from '../config'
import type { BrainNote, LogEntry, Order, OrderStatus, Project, Run, Schedule } from '../types'
import { uid } from '../util'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

interface SeedRun {
  project: Project
  prompt: string
  status: Run['status']
  ago: number
  orders: [string, OrderStatus, boolean?][]
  draft?: Order['draft']
}

function demoRuns(): SeedRun[] {
  const [first, second, ...rest] = projects.filter((p) => !p.fallback)
  const runs: SeedRun[] = []
  if (first)
    runs.push({
      project: first,
      prompt: 'Prepara una respuesta al último mensaje que he recibido',
      status: 'waiting',
      ago: 6 * MIN,
      orders: [
        [`Leer /brain y contexto de ${first.name}`, 'done'],
        ['Analizar el mensaje y su contexto', 'done'],
        ['Borrador de respuesta', 'awaiting_approval', true],
        ['Anotar aprendizajes en /brain', 'pending'],
      ],
      draft: {
        kind: 'message',
        to: 'Contacto de ejemplo',
        body: 'Hola, ¡gracias por escribirme!\n\nMe interesa lo que comentas. ¿Podrías darme algo más de detalle sobre los próximos pasos? Tengo disponibilidad esta semana para hablarlo.\n\nUn saludo',
      },
    })
  if (second)
    runs.push({
      project: second,
      prompt: 'Haz un plan para esta semana con las 3 prioridades',
      status: 'running',
      ago: 2 * MIN,
      orders: [
        [`Leer /brain y contexto de ${second.name}`, 'done'],
        ['Revisar tareas abiertas y pendientes', 'running'],
        ['Proponer las 3 prioridades de la semana', 'pending'],
        ['Anotar aprendizajes en /brain', 'pending'],
      ],
    })
  rest.forEach((p, i) =>
    runs.push({
      project: p,
      prompt: `Haz un primer resumen del estado de ${p.name}`,
      status: 'done',
      ago: (i + 1) * DAY + 3 * HOUR,
      orders: [
        [`Leer /brain y contexto de ${p.name}`, 'done'],
        ['Investigar y resumir', 'done'],
        [`Guardar resultado en ${p.folder}`, 'done'],
        ['Anotar aprendizajes en /brain', 'done'],
      ],
    }),
  )
  return runs
}

function demoNotes(): [string, string][] {
  return [
    [
      'index.md',
      `# The Brain

Memoria compartida de todos los agentes. Cada agente la lee al empezar y escribe aquí lo que aprende.

## Convenciones
- **perfil.md** → quién eres y cómo te gusta trabajar.
- **decisiones.md** → decisiones tomadas (con fecha).
- **proyectos/<id>.md** → datos estables de cada proyecto.

> Los agentes nunca borran notas: solo añaden o editan.`,
    ],
    [
      'perfil.md',
      `# Perfil

Rellena esta nota para que todos los agentes te conozcan:

- A qué te dedicas y qué buscas.
- Idioma y tono preferidos.
- Cosas que los agentes nunca deben hacer.`,
    ],
    ['decisiones.md', `# Decisiones\n\n- **AAAA-MM-DD** · Proyecto: decisión tomada y por qué.`],
    ...projects
      .filter((p) => !p.fallback)
      .map((p): [string, string] => [`proyectos/${p.id}.md`, `# ${p.name}\n\n${p.description}\n\n- Añade aquí datos estables del proyecto.`]),
  ]
}

function demoSchedules(): Schedule[] {
  return projects
    .filter((p) => !p.fallback)
    .slice(0, 4)
    .map((p, i) => ({
      id: uid(),
      projectId: p.id,
      title: `Revisión semanal · ${p.name}`,
      prompt: `Revisa el estado de ${p.name} y propón los siguientes pasos`,
      rule: { type: 'weekly' as const, weekdays: [(i % 5) + 1], time: ['09:00', '10:00', '18:00', '20:00'][i] },
      enabled: true,
    }))
}

export function seed() {
  const now = Date.now()
  const runs: Run[] = []
  const orders: Order[] = []
  const logs: LogEntry[] = []

  for (const r of demoRuns()) {
    const id = uid()
    const projectId = r.project.id
    const startedAt = now - r.ago
    runs.push({
      id,
      projectId,
      prompt: r.prompt,
      status: r.status,
      startedAt,
      endedAt: r.status === 'done' ? startedAt + 4 * MIN : undefined,
    })
    logs.push({ id: uid(), projectId, runId: id, ts: startedAt, level: 'info', text: `Nueva petición: "${r.prompt}"` })
    r.orders.forEach(([title, status, external], seq) => {
      const t = startedAt + (seq + 1) * 40_000
      orders.push({
        id: uid(),
        runId: id,
        projectId,
        seq,
        title,
        status,
        external: !!external,
        draft: status === 'awaiting_approval' ? r.draft : undefined,
        createdAt: startedAt,
        updatedAt: t,
      })
      if (status === 'done') logs.push({ id: uid(), projectId, runId: id, ts: t, level: 'info', text: `✓ ${title}` })
      if (status === 'awaiting_approval')
        logs.push({ id: uid(), projectId, runId: id, ts: t, level: 'approval', text: `⏸ Esperando tu aprobación: ${title}` })
    })
    if (r.status === 'done')
      logs.push({ id: uid(), projectId, runId: id, ts: startedAt + 4 * MIN, level: 'info', text: 'Run completado' })
  }
  logs.sort((a, b) => a.ts - b.ts)

  const notes: BrainNote[] = demoNotes().map(([path, content], i) => ({
    path,
    content,
    updatedAt: now - (i + 1) * 7 * HOUR,
    updatedBy: path.startsWith('proyectos/') ? path.slice(10, -3) : 'tú',
  }))

  return { runs, orders, logs, notes, schedules: demoSchedules() }
}
