// Agente real con el Claude Agent SDK.
import { mkdirSync } from 'node:fs'
import { query } from '@anthropic-ai/claude-agent-sdk'
import type { Project, Run } from '../../../shared/types'
import { brainContext } from '../brain'
import { agentEnv, BRAIN_DIR, loadConfig, projectFolder } from '../config'
import { repo } from '../db'
import { hq } from '../hq'
import { DISALLOWED_PATTERNS, makeGuard } from './guard'
import { HQ_TOOLS, hqServer } from './tools'

const MAX_TURNS = 40

function protocol(cwd: string, brain: string): string {
  return `

## Cómo trabajas dentro de The Brain
- Lo primero que haces es llamar a plan_orders con entre 2 y 6 órdenes concretas, en el orden en que las harás.
- Al empezar cada orden llamas a update_order con "running"; al terminarla, con "done" (o "failed" con una nota breve).
- Nunca envías mensajes, emails, publicaciones ni pagos, ni contactas a nadie. Para todo lo externo preparas el borrador completo y llamas a request_approval: el usuario lo aprueba o lo rechaza y, si lo aprueba, lo envía él.
- Tu carpeta de trabajo es ${cwd}. Guarda ahí lo que produzcas. No borres archivos.
- The Brain (${BRAIN_DIR}) es la memoria compartida de todos los agentes. Abajo tienes lo esencial. Cuando aprendas algo que deba recordarse (decisiones, datos estables, preferencias del usuario), guárdalo con brain_write. No escribas en brain/ con otras herramientas.
- Termina con un resumen breve de lo que has hecho, en el idioma del usuario.

## Lo que ya sabe The Brain
${brain}`
}

const summarize = (input: Record<string, unknown>): string => {
  const key = ['file_path', 'path', 'pattern', 'query', 'url', 'command'].find((k) => typeof input[k] === 'string')
  const v = key ? String(input[key]) : JSON.stringify(input)
  return v.length > 120 ? v.slice(0, 119) + '…' : v
}

export async function runClaude(project: Project, run: Run, abort: AbortController): Promise<void> {
  const { defaults } = loadConfig()
  const cwd = projectFolder(project)
  mkdirSync(BRAIN_DIR, { recursive: true })
  const model = project.model ?? defaults.model
  const log = (level: Parameters<typeof hq.log>[2], text: string, detail?: string) =>
    hq.log(project.id, run.id, level, text, detail)

  log('info', `Nueva petición: "${run.prompt}"`)

  const q = query({
    prompt: run.prompt,
    options: {
      model,
      cwd,
      systemPrompt: project.systemPrompt + protocol(cwd, brainContext(project)),
      abortController: abort,
      tools: project.tools,
      allowedTools: HQ_TOOLS,
      disallowedTools: DISALLOWED_PATTERNS,
      mcpServers: { hq: hqServer(project, run, cwd) },
      canUseTool: makeGuard(project, cwd, [BRAIN_DIR], (tool, reason, input) =>
        log('warn', `⛔ ${tool} bloqueada: ${reason}`, JSON.stringify(input)),
      ),
      permissionMode: 'default',
      settingSources: [],
      maxTurns: MAX_TURNS,
      env: agentEnv(),
    },
  })

  for await (const msg of q) {
    if (msg.type === 'system' && msg.subtype === 'init') {
      log('info', `Agente iniciado · ${model}`)
    } else if (msg.type === 'assistant') {
      for (const block of msg.message.content) {
        if (block.type === 'text' && block.text.trim()) {
          const t = block.text.trim()
          log('info', t.length > 400 ? t.slice(0, 399) + '…' : t, t)
        } else if (block.type === 'tool_use' && !block.name.startsWith('mcp__hq__')) {
          const input = (block.input ?? {}) as Record<string, unknown>
          log('tool', `${block.name} ${summarize(input)}`, JSON.stringify(input))
        }
      }
    } else if (msg.type === 'result') {
      const ok = msg.subtype === 'success' && !msg.is_error
      const result = msg.subtype === 'success' ? msg.result : msg.errors.join('\n') || msg.subtype
      // Lo que el agente dejó sin cerrar no se da por hecho.
      for (const o of repo.ordersOfRun(run.id)) {
        if (o.status === 'pending' || o.status === 'running')
          hq.patchOrder(o.id, { status: 'failed', note: 'El agente terminó sin completarla' })
      }
      hq.patchRun(run.id, {
        status: ok ? 'done' : 'failed',
        endedAt: Date.now(),
        result,
        costUsd: msg.total_cost_usd,
      })
      const label = ok ? 'Run completado' : msg.subtype === 'success' ? 'Run fallido' : `Run fallido (${msg.subtype})`
      log(ok ? 'info' : 'error', `${label} · ${msg.num_turns} turnos · $${msg.total_cost_usd.toFixed(4)}`, result)
    }
  }
}
