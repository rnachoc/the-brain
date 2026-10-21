// Estado central: cada cambio se guarda en SQLite y se emite a los clientes por WebSocket.
import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import type { LogLevel, Order, RouterQuestion, Run, Schedule, ServerEvent, Snapshot } from '../../shared/types'
import { listNotes, writeNote } from './brain'
import { hasClaude } from './config'
import { repo } from './db'

export const bus = new EventEmitter()
bus.setMaxListeners(100)

const emit = (e: ServerEvent) => bus.emit('event', e)

let question: RouterQuestion | null = null

export const uid = () => randomUUID().slice(0, 8)

export const hq = {
  snapshot(): Snapshot {
    const runs = repo.listRuns()
    return {
      runs,
      orders: repo.listOrders(runs.map((r) => r.id)),
      logs: repo.listLogs(),
      notes: listNotes(),
      schedules: repo.listSchedules(),
      schedulesPaused: hq.schedulesPaused(),
      question,
      live: hasClaude(),
    }
  },

  createRun(projectId: string, prompt: string, live: boolean): Run {
    const run: Run = { id: uid(), projectId, prompt, status: 'running', live, startedAt: Date.now() }
    repo.insertRun(run)
    emit({ type: 'run', run })
    return run
  },

  patchRun(id: string, patch: Partial<Run>): Run {
    const run = repo.updateRun(id, patch)
    emit({ type: 'run', run })
    return run
  },

  addOrders(run: Run, items: { title: string; external: boolean }[]): Order[] {
    const now = Date.now()
    const offset = repo.ordersOfRun(run.id).length
    return items.map((it, i) => {
      const order: Order = {
        id: uid(),
        runId: run.id,
        projectId: run.projectId,
        seq: offset + i,
        title: it.title,
        status: 'pending',
        external: it.external,
        createdAt: now,
        updatedAt: now,
      }
      repo.insertOrder(order)
      emit({ type: 'order', order })
      return order
    })
  },

  patchOrder(id: string, patch: Partial<Order>): Order {
    const order = repo.updateOrder(id, patch)
    emit({ type: 'order', order })
    return order
  },

  log(projectId: string, runId: string | undefined, level: LogLevel, text: string, detail?: string) {
    const log = repo.insertLog({ projectId, runId, ts: Date.now(), level, text, detail })
    emit({ type: 'log', log })
    return log
  },

  setQuestion(q: RouterQuestion | null) {
    question = q
    emit({ type: 'question', question: q })
  },
  getQuestion: () => question,

  /** Guarda una nota del Brain (con copia previa) y avisa a los clientes. */
  saveNote(path: string, content: string, by: string) {
    const note = writeNote(path, content, by)
    if (note) emit({ type: 'note', note })
    return note
  },

  saveSchedule(s: Schedule) {
    repo.upsertSchedule(s)
    emit({ type: 'schedule', schedule: repo.getSchedule(s.id)! })
  },
  removeSchedule(id: string) {
    repo.deleteSchedule(id)
    emit({ type: 'scheduleRemoved', id })
  },
  schedulesPaused: () => repo.getSetting('schedulesPaused') === 'true',
  setSchedulesPaused(paused: boolean) {
    repo.setSetting('schedulesPaused', String(paused))
    emit({ type: 'schedulesPaused', paused })
  },

  routed(text: string, projectIds: string[]) {
    emit({ type: 'routed', note: { id: uid(), text, ts: Date.now(), projectIds } })
  },
}

// ---------- Aprobaciones ----------
// Una orden externa espera aquí hasta que el usuario pulsa Aprobar o Rechazar.

const pending = new Map<string, (ok: boolean) => void>()

export function waitForApproval(orderId: string): Promise<boolean> {
  return new Promise((resolve) => pending.set(orderId, resolve))
}

export function resolveApproval(orderId: string, ok: boolean): boolean {
  const fn = pending.get(orderId)
  if (!fn) return false
  pending.delete(orderId)
  fn(ok)
  return true
}
