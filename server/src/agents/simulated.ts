// Agente simulado: mismo flujo y mismos eventos que el real, sin llamar a ningún modelo.
// Se usa cuando no hay API key o para proyectos que aún no son live.
import type { Draft, Project, Run } from '../../../shared/types'
import { repo } from '../db'
import { hq, waitForApproval } from '../hq'

const EXTERNAL_RE = /(respond|contesta|envi|manda|publica|post|email|correo|mensaje|comunicado|tuit|paga|escribe a|dm\b)/i

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const rand = (a: number, b: number) => a + Math.random() * (b - a)
const short = (s: string, n = 48) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

function plan(p: Project, prompt: string) {
  const external = EXTERNAL_RE.test(prompt)
  return [
    { title: `Leer /brain y contexto de ${p.name}`, external: false },
    { title: `Analizar: "${short(prompt)}"`, external: false },
    { title: 'Investigar y preparar el contenido', external: false },
    external
      ? { title: 'Borrador listo para enviar', external: true }
      : { title: `Guardar resultado en ${p.folder}`, external: false },
    { title: 'Anotar aprendizajes en /brain', external: false },
  ]
}

function draft(p: Project, prompt: string): Draft {
  if (/(publica|post|tuit|redes)/i.test(prompt))
    return { kind: 'post', to: 'Redes sociales', body: `${prompt}\n\n(Borrador simulado de ${p.name}.)` }
  if (/(email|correo)/i.test(prompt))
    return { kind: 'email', to: 'Destinatario', subject: short(prompt, 60), body: `Hola,\n\n${prompt}\n\nUn saludo` }
  return { kind: 'message', to: 'Destinatario', body: `Hola,\n\n${prompt}\n\n(Borrador simulado de ${p.name}.)` }
}

function toolLines(p: Project, title: string): string[] {
  const pool = [
    'Read brain/index.md',
    `Glob ${p.folder}/**/*.md`,
    `Grep "${title.split(' ')[0].toLowerCase()}" ${p.folder}`,
    `WebSearch "${short(title, 30)}"`,
    `Write ${p.folder}/notas/${new Date().toISOString().slice(0, 10)}.md`,
  ]
  return Array.from({ length: Math.round(rand(2, 3.4)) }, () => pool[Math.floor(Math.random() * pool.length)])
}

export async function runSimulated(project: Project, run: Run, abort: AbortController): Promise<void> {
  const log = (level: Parameters<typeof hq.log>[2], text: string) => {
    if (!abort.signal.aborted) hq.log(project.id, run.id, level, text)
  }
  const sleep = async (ms: number) => {
    await wait(ms)
    if (abort.signal.aborted) throw new Error('Cancelado')
  }
  log('info', `Nueva petición (simulada): "${run.prompt}"`)
  const orders = hq.addOrders(run, plan(project, run.prompt))
  log('info', `Plan: ${orders.length} órdenes publicadas en la cola`)

  for (const o of orders) {
    hq.patchOrder(o.id, { status: 'running' })
    log('info', `▶ ${o.title}`)
    for (const line of toolLines(project, o.title)) {
      await sleep(rand(700, 1500))
      log('tool', line)
    }
    await sleep(rand(400, 900))
    if (!o.external) {
      hq.patchOrder(o.id, { status: 'done' })
      log('info', `✓ ${o.title}`)
      continue
    }
    hq.patchOrder(o.id, { status: 'awaiting_approval', draft: draft(project, run.prompt) })
    hq.patchRun(run.id, { status: 'waiting' })
    log('approval', `⏸ Esperando tu aprobación: ${o.title}`)
    const ok = await waitForApproval(o.id)
    if (abort.signal.aborted) throw new Error('Cancelado')
    hq.patchOrder(o.id, { status: ok ? 'done' : 'rejected' })
    hq.patchRun(run.id, { status: 'running' })
    log(ok ? 'info' : 'warn', ok ? '✓ Aprobado: el borrador queda listo para que lo envíes tú' : '✗ Rechazado: no se hace nada con el borrador')
  }

  const done = repo.ordersOfRun(run.id).filter((o) => o.status === 'done').length
  hq.patchRun(run.id, { status: 'done', endedAt: Date.now(), result: `Simulación completada: ${done} órdenes hechas.` })
  log('info', 'Run completado')
}
