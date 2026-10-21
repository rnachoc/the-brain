import { join } from 'node:path'
import websocket from '@fastify/websocket'
import { config as loadEnv } from 'dotenv'
import Fastify from 'fastify'
import { ROOT } from './config'

loadEnv({ path: join(ROOT, '.env'), quiet: true })

// Después de cargar .env: estos módulos leen la API key.
const { claudeAuth, loadConfig } = await import('./config')
const { repo } = await import('./db')
const { bus, hq, resolveApproval } = await import('./hq')
const { answerQuestion, cancelRun, handleChat } = await import('./orchestrator')
const { ensureBrain, listNotes } = await import('./brain')
const { runSchedule, startScheduler } = await import('./scheduler')
const { isValidRule } = await import('../../shared/schedule')
type Schedule = import('../../shared/types').Schedule
const { uid } = await import('./hq')

// Variable propia: PORT la suelen fijar otras herramientas para el servidor web.
const PORT = Number(process.env.SERVER_PORT ?? 8787)
const app = Fastify({ logger: { level: 'warn' } })
await app.register(websocket)

app.get('/api/state', async () => hq.snapshot())

app.post<{ Body: { text?: string } }>('/api/chat', async (req, reply) => {
  const text = req.body?.text?.trim()
  if (!text) return reply.code(400).send({ error: 'Mensaje vacío' })
  return handleChat(text)
})

app.post<{ Body: { projectIds?: string[] } }>('/api/question/answer', async (req) =>
  answerQuestion(req.body?.projectIds ?? []),
)

app.post('/api/question/dismiss', async () => {
  hq.setQuestion(null)
  return { ok: true }
})

app.post<{ Params: { id: string; action: 'approve' | 'reject' } }>('/api/orders/:id/:action', async (req, reply) => {
  const { id, action } = req.params
  if (action !== 'approve' && action !== 'reject') return reply.code(404).send({ error: 'Acción desconocida' })
  const order = repo.getOrder(id)
  if (!order || order.status !== 'awaiting_approval') return reply.code(409).send({ error: 'La orden no espera aprobación' })
  if (!resolveApproval(id, action === 'approve')) return reply.code(409).send({ error: 'Ningún agente espera esta orden' })
  return { ok: true }
})

app.post<{ Params: { id: string } }>('/api/runs/:id/cancel', async (req, reply) =>
  cancelRun(req.params.id) ? { ok: true } : reply.code(409).send({ error: 'Ese run no está en marcha' }),
)

app.get('/api/brain', async () => listNotes())

// ---------- Tareas programadas ----------

type ScheduleBody = Partial<Pick<Schedule, 'projectId' | 'title' | 'prompt' | 'rule' | 'enabled'>>

function validSchedule(b: ScheduleBody | undefined): string | null {
  if (!b?.projectId || !loadConfig().projects.some((p) => p.id === b.projectId)) return 'Proyecto no válido'
  if (!b.title?.trim() || !b.prompt?.trim()) return 'Faltan título u orden'
  if (!isValidRule(b.rule)) return 'Regla de programación no válida'
  return null
}

app.post<{ Body: ScheduleBody }>('/api/schedules', async (req, reply) => {
  const err = validSchedule(req.body)
  if (err) return reply.code(400).send({ error: err })
  const b = req.body as Required<ScheduleBody>
  const s: Schedule = { id: uid(), projectId: b.projectId, title: b.title.trim(), prompt: b.prompt.trim(), rule: b.rule, enabled: b.enabled ?? true, createdAt: Date.now() }
  hq.saveSchedule(s)
  return s
})

app.patch<{ Params: { id: string }; Body: ScheduleBody }>('/api/schedules/:id', async (req, reply) => {
  const cur = repo.getSchedule(req.params.id)
  if (!cur) return reply.code(404).send({ error: 'No existe' })
  const next = { ...cur, ...req.body, id: cur.id }
  const err = validSchedule(next)
  if (err) return reply.code(400).send({ error: err })
  hq.saveSchedule(next)
  return next
})

app.delete<{ Params: { id: string } }>('/api/schedules/:id', async (req) => {
  hq.removeSchedule(req.params.id)
  return { ok: true }
})

app.post<{ Params: { id: string } }>('/api/schedules/:id/run', async (req, reply) => {
  const s = repo.getSchedule(req.params.id)
  if (!s) return reply.code(404).send({ error: 'No existe' })
  return { ok: runSchedule(s, 'manual') }
})

app.post<{ Body: { paused?: boolean } }>('/api/schedules/pause', async (req) => {
  hq.setSchedulesPaused(!!req.body?.paused)
  return { paused: hq.schedulesPaused() }
})

app.put<{ Body: { path?: string; content?: string } }>('/api/brain', async (req, reply) => {
  const { path, content } = req.body ?? {}
  if (typeof path !== 'string' || typeof content !== 'string') return reply.code(400).send({ error: 'Faltan path o content' })
  const note = hq.saveNote(path, content, 'tú')
  return note ?? reply.code(400).send({ error: 'Ruta no válida: usa una ruta .md dentro de brain/' })
})

app.get('/ws', { websocket: true }, (socket) => {
  socket.send(JSON.stringify({ type: 'snapshot', state: hq.snapshot() }))
  const forward = (e: unknown) => socket.send(JSON.stringify(e))
  bus.on('event', forward)
  socket.on('close', () => bus.off('event', forward))
})

const interrupted = repo.failInterrupted()
ensureBrain(loadConfig().projects)
startScheduler()
await app.listen({ port: PORT, host: '127.0.0.1' })

const { projects } = loadConfig()
const live = projects.filter((p) => p.live !== false).map((p) => p.name)
console.log(`\n  🧠 The Brain · servidor en http://localhost:${PORT}`)
const auth = claudeAuth()
console.log(
  auth
    ? `  ✓ Claude conectado (${auth === 'subscription' ? 'tu suscripción' : 'API key'}) · agentes reales: ${live.join(', ') || 'ninguno'}`
    : '  ⚠ Claude sin conectar · modo simulado. Ejecuta "npm run login" y pega el token en .env',
)
if (interrupted) console.log(`  ↺ ${interrupted} run(s) interrumpidos por un reinicio marcados como fallidos`)
console.log()
