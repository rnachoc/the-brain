// Lanza las tareas programadas a su hora. Cada una es una orden como si la escribieras tú,
// dirigida a su proyecto. Las ejecuciones que caen con el servidor apagado no se recuperan,
// para que reiniciar nunca dispare una ráfaga de agentes (y consumo) de golpe.
import { dueBetween } from '../../shared/schedule'
import type { Schedule } from '../../shared/types'
import { loadConfig } from './config'
import { repo } from './db'
import { hq } from './hq'
import { startRun } from './orchestrator'

const TICK_MS = 20_000

export function runSchedule(s: Schedule, reason: 'scheduled' | 'manual') {
  const project = loadConfig().projects.find((p) => p.id === s.projectId)
  if (!project) {
    hq.log(s.projectId, undefined, 'warn', `⏰ "${s.title}" no se lanzó: el proyecto ya no existe en config.json`)
    return false
  }
  hq.saveSchedule({ ...s, lastRunAt: Date.now(), enabled: s.rule.type === 'once' && reason === 'scheduled' ? false : s.enabled })
  hq.log(project.id, undefined, 'info', `⏰ ${reason === 'manual' ? 'Lanzada a mano' : 'Programada'}: ${s.title}`)
  hq.routed(`⏰ ${s.title} → ${project.name}`, [project.id])
  startRun(project, s.prompt)
  return true
}

export function startScheduler() {
  let last = new Date()
  setInterval(() => {
    const now = new Date()
    if (!hq.schedulesPaused()) {
      for (const s of repo.listSchedules()) if (s.enabled && dueBetween(s.rule, last, now)) runSchedule(s, 'scheduled')
    }
    last = now
  }, TICK_MS)
}
