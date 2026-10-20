// Notas del Brain y tareas programadas de ejemplo (las fases c y d las pasan al servidor).
// Se generan a partir de los proyectos de config.json, así que se adaptan a cada usuario.
import { projects } from '../config'
import type { BrainNote, Schedule } from '../types'
import { uid } from '../util'

const HOUR = 60 * 60_000

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
  const notes: BrainNote[] = demoNotes().map(([path, content], i) => ({
    path,
    content,
    updatedAt: now - (i + 1) * 7 * HOUR,
    updatedBy: path.startsWith('proyectos/') ? path.slice(10, -3) : 'tú',
  }))
  return { notes, schedules: demoSchedules() }
}
