// Acciones aprobadas: comandos fijos de config.json que ejecuta el servidor, nunca el agente.
// Solo se lanzan tras tu aprobación. El agente no puede inventar ni modificar el comando.
import { spawn } from 'node:child_process'
import type { Order, Project, ProjectAction, Run } from '../../shared/types'
import { projectFolder } from './config'
import { hq } from './hq'

const DEFAULT_TIMEOUT_SEC = 900
const ANSI = /\x1b\[[0-9;]*[A-Za-z]/g

export function findAction(project: Project, id: string | undefined): ProjectAction | undefined {
  return id ? project.actions?.find((a) => a.id === id) : undefined
}

/** Entorno del comando sin las credenciales de Claude: la acción no las necesita. */
function actionEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  delete env.CLAUDE_CODE_OAUTH_TOKEN
  delete env.ANTHROPIC_API_KEY
  return env
}

/**
 * Ejecuta la acción en la carpeta del proyecto, con límite de tiempo. Cada línea de salida va al
 * log (nivel tool). Devuelve si terminó bien y las últimas líneas, que quedan como nota de la orden.
 */
export function runAction(project: Project, action: ProjectAction, run: Run, signal?: AbortSignal): Promise<{ ok: boolean; tail: string }> {
  return new Promise((done) => {
    let cwd: string
    try {
      cwd = projectFolder(project)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      hq.log(project.id, run.id, 'error', msg)
      return done({ ok: false, tail: msg })
    }
    const timeoutSec = action.timeoutSec ?? DEFAULT_TIMEOUT_SEC
    hq.log(project.id, run.id, 'info', `▶ Ejecutando: ${action.label}`, action.command)
    // El comando es texto fijo de config.json (lo escribes tú); nada del agente se interpola en él.
    const child = spawn(action.command, { cwd, shell: true, env: actionEnv(), windowsHide: true })
    const tail: string[] = []
    let rest = ''
    const onData = (chunk: Buffer) => {
      const lines = (rest + chunk.toString('utf8')).split(/\r?\n/)
      rest = lines.pop() ?? ''
      for (const raw of lines) {
        const line = raw.replace(ANSI, '').trimEnd()
        if (!line) continue
        hq.log(project.id, run.id, 'tool', line.length > 400 ? line.slice(0, 399) + '…' : line)
        tail.push(line)
        if (tail.length > 6) tail.shift()
      }
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    let killedBy: string | null = null
    const kill = (why: string) => {
      killedBy = why
      child.kill()
    }
    const timer = setTimeout(() => kill(`Tiempo agotado (${timeoutSec} s)`), timeoutSec * 1000)
    signal?.addEventListener('abort', () => kill('Cancelado por ti'), { once: true })
    child.on('error', (err) => {
      clearTimeout(timer)
      hq.log(project.id, run.id, 'error', `No se pudo ejecutar: ${err.message}`)
      done({ ok: false, tail: err.message })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (rest.trim()) onData(Buffer.from('\n'))
      const ok = code === 0 && !killedBy
      const note = killedBy ?? (tail.slice(-3).join('\n') || `Código de salida ${code}`)
      hq.log(project.id, run.id, ok ? 'info' : 'error', ok ? `✓ ${action.label}: hecho` : `✗ ${action.label}: ${killedBy ?? `falló (código ${code})`}`)
      done({ ok, tail: note })
    })
  })
}

/**
 * Tras aprobar una orden con acción: la ejecuta (o la simula en un run simulado) y deja la orden
 * en done o failed con las últimas líneas como nota.
 */
export async function executeApproved(project: Project, run: Run, order: Order, signal?: AbortSignal): Promise<{ ok: boolean; tail: string }> {
  const action = findAction(project, order.action?.id)
  if (!action) {
    hq.patchOrder(order.id, { status: 'failed', note: 'La acción ya no existe en config.json' })
    return { ok: false, tail: 'La acción ya no existe en config.json' }
  }
  hq.patchOrder(order.id, { status: 'running' })
  hq.patchRun(run.id, { status: 'running' })
  const result = await runAction(project, action, run, signal)
  hq.patchOrder(order.id, { status: result.ok ? 'done' : 'failed', note: result.tail })
  return result
}
