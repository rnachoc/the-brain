// Recibe los mensajes del chat, los enruta y lanza los agentes (en paralelo si hay varios).
import Anthropic from '@anthropic-ai/sdk'
import type { Project } from '../../shared/types'
import { runClaude } from './agents/claude'
import { runSimulated } from './agents/simulated'
import { hasApiKey, loadConfig } from './config'
import { repo } from './db'
import { hq, uid } from './hq'
import { route, type RouteDecision } from './router'

let client: Anthropic | null = null
const anthropic = () => (hasApiKey() ? (client ??= new Anthropic()) : null)

const VIA: Record<string, string> = { mention: '@mención', model: 'router', keywords: 'palabras clave' }

function startRun(project: Project, prompt: string) {
  const live = hasApiKey() && !!project.live
  const run = hq.createRun(project.id, prompt, live)
  const runner = live ? runClaude : runSimulated
  runner(project, run).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err)
    for (const o of repo.ordersOfRun(run.id))
      if (o.status !== 'done' && o.status !== 'rejected') hq.patchOrder(o.id, { status: 'failed', note: msg })
    hq.patchRun(run.id, { status: 'failed', endedAt: Date.now(), result: msg })
    hq.log(project.id, run.id, 'error', `Error del agente: ${msg}`)
  })
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
    decision = await route(text, config, anthropic())
  } catch (err) {
    const fallback = config.projects.find((p) => p.fallback) ?? config.projects[0]
    hq.log(fallback.id, undefined, 'warn', `Router con Claude no disponible, uso palabras clave: ${err instanceof Error ? err.message : err}`)
    decision = await route(text, config, null)
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
