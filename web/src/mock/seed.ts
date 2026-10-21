// Tareas programadas de ejemplo (la fase d las pasa al servidor).
// Se generan a partir de los proyectos de config.json, así que se adaptan a cada usuario.
import { projects } from '../config'
import type { Schedule } from '../types'
import { uid } from '../util'

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
  return { schedules: demoSchedules() }
}
