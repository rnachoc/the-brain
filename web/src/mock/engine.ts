// Motor de agentes simulado (fase a): descompone, ejecuta y pide aprobación
// con la misma forma de eventos que usará el backend real.
import type { StoreApi } from 'zustand'
import { projectById, projects } from '../config'
import type { Draft, LogLevel, Order, Project, Run } from '../types'
import { rand, sleep, uid } from '../util'
import type { State } from '../store'
import { routeMock } from './router'

const EXTERNAL_RE = /(respond|contesta|envi|manda|publica|post|email|correo|mensaje|comunicado|tuit|paga|escribe a|dm\b)/i

const short = (s: string, n = 48) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

function planOrders(p: Project, prompt: string): Pick<Order, 'title' | 'external'>[] {
  const external = EXTERNAL_RE.test(prompt)
  const steps: Pick<Order, 'title' | 'external'>[] = [
    { title: `Leer /brain y contexto de ${p.name}`, external: false },
    { title: `Analizar: "${short(prompt)}"`, external: false },
    { title: 'Investigar y preparar el contenido', external: false },
  ]
  steps.push(
    external
      ? { title: 'Borrador listo para enviar', external: true }
      : { title: `Guardar resultado en ${p.folder}`, external: false },
  )
  steps.push({ title: 'Anotar aprendizajes en /brain', external: false })
  return steps
}

function makeDraft(p: Project, prompt: string): Draft {
  if (/(publica|post|tuit|redes)/i.test(prompt))
    return { kind: 'post', to: 'Redes sociales', body: `${prompt}\n\n(Borrador de ejemplo generado por ${p.name}.)` }
  if (/(email|correo)/i.test(prompt))
    return { kind: 'email', to: 'Destinatario', subject: short(prompt, 60), body: `Hola,\n\n${prompt}\n\nUn saludo` }
  return { kind: 'message', to: 'Destinatario', body: `Hola,\n\n${prompt}\n\n(Borrador de ejemplo generado por ${p.name}.)` }
}

function toolLines(p: Project, o: Order): string[] {
  const pool = [
    `Read brain/index.md`,
    `Read brain/proyectos/${p.id}.md`,
    `Glob ${p.folder}/**/*.md`,
    `Grep "${o.title.split(' ')[0].toLowerCase()}" ${p.folder}`,
    `WebSearch "${short(o.title, 30)}"`,
    `Write ${p.folder}/notas/${new Date().toISOString().slice(0, 10)}.md`,
    `Edit ${p.folder}/resumen.md`,
  ]
  const n = Math.round(rand(2, 3.4))
  return Array.from({ length: n }, () => pool[Math.floor(Math.random() * pool.length)])
}

type Get = StoreApi<State>['getState']
type Set = StoreApi<State>['setState']

export function createEngine(get: Get, set: Set) {
  const resolvers = new Map<string, (ok: boolean) => void>()
  const activeLoops = new Set<string>()

  const log = (projectId: string, runId: string | undefined, level: LogLevel, text: string) =>
    set((s) => ({ logs: [...s.logs.slice(-1999), { id: uid(), projectId, runId, ts: Date.now(), level, text }] }))

  const patchOrder = (id: string, patch: Partial<Order>) =>
    set((s) => ({ orders: s.orders.map((o) => (o.id === id ? { ...o, ...patch, updatedAt: Date.now() } : o)) }))

  const patchRun = (id: string, patch: Partial<Run>) =>
    set((s) => ({ runs: s.runs.map((r) => (r.id === id ? { ...r, ...patch } : r)) }))

  async function runLoop(runId: string) {
    if (activeLoops.has(runId)) return
    activeLoops.add(runId)
    const run = get().runs.find((r) => r.id === runId)!
    const p = projectById(run.projectId)
    const ids = get()
      .orders.filter((o) => o.runId === runId)
      .sort((a, b) => a.seq - b.seq)
      .map((o) => o.id)

    for (const id of ids) {
      const o = get().orders.find((x) => x.id === id)!
      if (o.status === 'done' || o.status === 'rejected' || o.status === 'failed') continue

      if (o.status !== 'awaiting_approval') {
        patchRun(runId, { status: 'running' })
        patchOrder(id, { status: 'running' })
        log(p.id, runId, 'info', `▶ ${o.title}`)
        for (const line of toolLines(p, o)) {
          await sleep(rand(700, 1600))
          log(p.id, runId, 'tool', line)
        }
        await sleep(rand(500, 1100))
        if (!o.external) {
          patchOrder(id, { status: 'done' })
          log(p.id, runId, 'info', `✓ ${o.title}`)
          continue
        }
        patchOrder(id, { status: 'awaiting_approval', draft: o.draft ?? makeDraft(p, run.prompt) })
        log(p.id, runId, 'approval', `⏸ Esperando tu aprobación: ${o.title}`)
      }

      patchRun(runId, { status: 'waiting' })
      const ok = await new Promise<boolean>((res) => resolvers.set(id, res))
      resolvers.delete(id)
      patchOrder(id, { status: ok ? 'done' : 'rejected' })
      log(
        p.id,
        runId,
        ok ? 'info' : 'warn',
        ok ? '✓ Aprobado: el borrador queda listo para que lo envíes tú' : '✗ Rechazado: no se hace nada con el borrador',
      )
      patchRun(runId, { status: 'running' })
    }

    patchRun(runId, { status: 'done', endedAt: Date.now() })
    log(p.id, runId, 'info', 'Run completado')
    activeLoops.delete(runId)
  }

  function startRun(projectId: string, prompt: string) {
    const p = projectById(projectId)
    const runId = uid()
    const now = Date.now()
    const plan = planOrders(p, prompt)
    set((s) => ({
      runs: [...s.runs, { id: runId, projectId: p.id, prompt, status: 'running', startedAt: now }],
      orders: [
        ...s.orders,
        ...plan.map((o, i) => ({
          id: uid(),
          runId,
          projectId: p.id,
          seq: i,
          title: o.title,
          external: o.external,
          status: 'pending' as const,
          createdAt: now,
          updatedAt: now,
        })),
      ],
    }))
    log(p.id, runId, 'info', `Nueva petición: "${prompt}"`)
    log(p.id, runId, 'info', `Plan: ${plan.length} órdenes publicadas en la cola`)
    void runLoop(runId)
  }

  function announce(projectIds: string[]) {
    const names = projectIds.map((id) => projectById(id).name).join(' · ')
    set({ routerNote: { id: uid(), text: `→ Enrutado a ${names}`, ts: Date.now(), projectIds } })
  }

  return {
    dispatch(text: string) {
      const r = routeMock(text)
      if (r.question) {
        set({
          question: { id: uid(), text: r.question, prompt: r.prompt, options: projects.map((p) => p.id) },
        })
        return
      }
      announce(r.projectIds)
      r.projectIds.forEach((id) => startRun(id, r.prompt))
    },
    answer(projectIds: string[]) {
      const q = get().question
      if (!q) return
      set({ question: null })
      announce(projectIds)
      projectIds.forEach((id) => startRun(id, q.prompt))
    },
    resolve(orderId: string, ok: boolean) {
      resolvers.get(orderId)?.(ok)
    },
    boot() {
      get()
        .runs.filter((r) => r.status !== 'done' && r.status !== 'failed')
        .forEach((r) => void runLoop(r.id))
    },
  }
}
