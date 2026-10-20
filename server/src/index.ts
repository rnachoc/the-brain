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
const { answerQuestion, handleChat } = await import('./orchestrator')

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

app.get('/ws', { websocket: true }, (socket) => {
  socket.send(JSON.stringify({ type: 'snapshot', state: hq.snapshot() }))
  const forward = (e: unknown) => socket.send(JSON.stringify(e))
  bus.on('event', forward)
  socket.on('close', () => bus.off('event', forward))
})

const interrupted = repo.failInterrupted()
await app.listen({ port: PORT, host: '127.0.0.1' })

const { projects } = loadConfig()
const live = projects.filter((p) => p.live).map((p) => p.name)
console.log(`\n  🧠 The Brain · servidor en http://localhost:${PORT}`)
const auth = claudeAuth()
console.log(
  auth
    ? `  ✓ Claude conectado (${auth === 'subscription' ? 'tu suscripción' : 'API key'}) · agentes reales: ${live.join(', ') || 'ninguno (marca "live": true en config.json)'}`
    : '  ⚠ Claude sin conectar · modo simulado. Ejecuta "npm run login" y pega el token en .env',
)
if (interrupted) console.log(`  ↺ ${interrupted} run(s) interrumpidos por un reinicio marcados como fallidos`)
console.log()
