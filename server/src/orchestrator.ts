// Recibe los mensajes del chat, los enruta y lanza los agentes (en paralelo si hay varios).
import type { Project } from '../../shared/types'
import { runClaude } from './agents/claude'
import { runSimulated } from './agents/simulated'
import { hasClaude, loadConfig } from './config'
import { repo } from './db'
import { hq, resolveApproval, uid } from './hq'
import { route, type RouteDecision } from './router'

const VIA: Record<string, string> = { mention: '@mención', model: 'router', keywords: 'palabras clave' }

const running = new Map<string, AbortController>()

function startRun(project: Project, prompt: string) {
  // Con Claude conectado todos los agentes son reales, salvo los marcados con live: false.
  const live = hasClaude() && project.live !== false
  const run = hq.createRun(project.id, prompt, live)
  const abort = new AbortController()
  running.set(run.id, abort)
  const runner = live ? runClaude : runSimulated
  runner(project, run, abort)
    .catch((err: unknown) => {
      // Si el agente ya cerró el run (o lo cancelaste), no lo registramos dos veces.
      if (repo.getRun(run.id)?.status === 'failed') return
    const msg = err instanceof Error ? err.message : String(err)
    for (const o of repo.ordersOfRun(run.id))
      if (o.status !== 'done' && o.status !== 'rejected') hq.patchOrder(o.id, { status: 'failed', note: msg })
    hq.patchRun(run.id, { status: 'failed', endedAt: Date.now(), result: msg })
    hq.log(project.id, run.id, 'error', `Error del agente: ${msg}`)
    })
    .finally(() => running.delete(run.id))
}

/** Detiene un run en marcha: se rechazan sus borradores pendientes y nada queda como hecho. */
export function cancelRun(runId: string): boolean {
  const run = repo.getRun(runId)
  const abort = running.get(runId)
  if (!run || !abort || (run.status !== 'running' && run.status !== 'waiting')) return false
  hq.patchRun(runId, { status: 'failed', endedAt: Date.now(), result: 'Cancelado por ti' })
  for (const o of repo.ordersOfRun(runId)) {
    if (o.status === 'awaiting_approval') resolveApproval(o.id, false)
    if (o.status === 'pending' || o.status === 'running' || o.status === 'awaiting_approval')
      hq.patchOrder(o.id, { status: 'failed', note: 'Cancelado' })
  }
  abort.abort()
  hq.log(run.projectId, runId, 'warn', '■ Run cancelado por ti')
  return true
}

function dispatch(targets: { projectId: string; prompt: string }[], via: string) {
  const { projects } = loadConfig()
  const valid = targets
    .map((t) => ({ ...t, project: projects.find((p) => p.id === t.projectId) }))
    .filter((t): t is typeof t & { project: Project } => !!t.project)
  hq.routed(`→ ${valid.map((t) => t.project.name).join(' · ')} (${via})`, valid.map((t) => t.projectId))
  for (const t of valid) startRun(t.project, t.prompt)
  return valid.map((t) => t.projectId)
}

export async function handleChat(text: string) {
  const config = loadConfig()
  const msgId = uid()
  repo.insertMessage(msgId, text, Date.now())
  hq.setQuestion(null)

  let decision: RouteDecision
  try {
    decision = await route(text, config, hasClaude())
  } catch (err) {
    const fallback = config.projects.find((p) => p.fallback) ?? config.projects[0]
    hq.log(fallback.id, undefined, 'warn', `Router con Claude no disponible, uso palabras clave: ${err instanceof Error ? err.message : err}`)
    decision = await route(text, config, false)
  }

  if (decision.kind === 'ask') {
    hq.setQuestion({ id: msgId, text: decision.question, prompt: decision.prompt, options: decision.options })
    return { asked: true }
  }
  const ids = dispatch(decision.targets, VIA[decision.via])
  repo.setMessageRouting(msgId, ids)
  return { routedTo: ids }
}

export function answerQuestion(projectIds: string[]) {
  const q = hq.getQuestion()
  if (!q) return { routedTo: [] }
  hq.setQuestion(null)
  const ids = dispatch(projectIds.map((projectId) => ({ projectId, prompt: q.prompt })), 'elegido por ti')
  repo.setMessageRouting(q.id, ids)
  return { routedTo: ids }
}
