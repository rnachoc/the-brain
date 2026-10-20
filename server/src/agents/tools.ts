// Herramientas MCP con las que el agente publica su plan, avanza órdenes y pide aprobación.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import type { Order, Run } from '../../../shared/types'
import { hq, waitForApproval } from '../hq'
import { repo } from '../db'

export const HQ_TOOLS = ['mcp__hq__plan_orders', 'mcp__hq__update_order', 'mcp__hq__request_approval']

const text = (t: string) => ({ content: [{ type: 'text' as const, text: t }] })

const DAY_MS = 24 * 60 * 60 * 1000

export function hqServer(run: Run, cwd: string) {
  const byNumber = (n: number): Order | undefined => repo.ordersOfRun(run.id).find((o) => o.seq === n - 1)

  const planOrders = tool(
    'plan_orders',
    'Publica en la cola del usuario el plan de esta petición: entre 2 y 6 órdenes concretas, en el orden en que las vas a hacer. Llámala una sola vez, antes de empezar. Marca external = true en las órdenes que afecten a algo fuera (enviar un mensaje, email o publicación, contactar a alguien, pagar).',
    {
      orders: z
        .array(z.object({ title: z.string().describe('Orden corta e imperativa'), external: z.boolean() }))
        .min(1)
        .max(6),
    },
    async ({ orders }) => {
      if (repo.ordersOfRun(run.id).length) return text('Ya publicaste un plan. Usa update_order para avanzar.')
      const created = hq.addOrders(run, orders)
      hq.log(run.projectId, run.id, 'info', `Plan: ${created.length} órdenes publicadas en la cola`)
      return text(`Plan publicado:\n${created.map((o) => `${o.seq + 1}. ${o.title}${o.external ? ' (externa)' : ''}`).join('\n')}`)
    },
  )

  const updateOrder = tool(
    'update_order',
    'Marca el estado de una orden del plan. Llámala con "running" al empezar cada orden y con "done" (o "failed" con una nota) al terminarla. Para las órdenes externas usa request_approval en lugar de "done".',
    {
      number: z.number().int().min(1).describe('Número de la orden (1, 2, 3…)'),
      status: z.enum(['running', 'done', 'failed']),
      note: z.string().optional(),
    },
    async ({ number, status, note }) => {
      const o = byNumber(number)
      if (!o) return text(`No existe la orden ${number}.`)
      if (o.external && status === 'done') return text('Es una orden externa: usa request_approval con el borrador.')
      hq.patchOrder(o.id, { status, note })
      hq.log(run.projectId, run.id, status === 'failed' ? 'warn' : 'info', `${status === 'running' ? '▶' : status === 'done' ? '✓' : '✗'} ${o.title}${note ? ` — ${note}` : ''}`)
      return text('OK')
    },
  )

  const requestApproval = tool(
    'request_approval',
    'Entrega el borrador final de una orden externa y espera a que el usuario lo apruebe o lo rechace. Nunca envías nada tú: aprobar solo significa que el borrador queda listo para que el usuario lo envíe.',
    {
      number: z.number().int().min(1),
      kind: z.enum(['email', 'message', 'post', 'payment', 'other']),
      to: z.string().optional().describe('Destinatario o canal'),
      subject: z.string().optional(),
      body: z.string().describe('Texto completo del borrador'),
    },
    async ({ number, kind, to, subject, body }) => {
      const o = byNumber(number)
      if (!o) return text(`No existe la orden ${number}.`)
      const draft = { kind, to, subject, body }

      // Copia del borrador en la carpeta del agente, para tenerlo aunque se cierre el panel.
      const dir = join(cwd, 'borradores')
      mkdirSync(dir, { recursive: true })
      const file = join(dir, `${new Date().toISOString().slice(0, 10)}-${run.id}-${number}.md`)
      writeFileSync(file, `# ${o.title}\n\n${to ? `**Para:** ${to}\n\n` : ''}${subject ? `**Asunto:** ${subject}\n\n` : ''}${body}\n`)

      hq.patchOrder(o.id, { status: 'awaiting_approval', external: true, draft })
      hq.patchRun(run.id, { status: 'waiting' })
      hq.log(run.projectId, run.id, 'approval', `⏸ Esperando tu aprobación: ${o.title}`, JSON.stringify(draft))

      const ok = await waitForApproval(o.id)
      hq.patchOrder(o.id, { status: ok ? 'done' : 'rejected' })
      hq.patchRun(run.id, { status: 'running' })
      hq.log(
        run.projectId,
        run.id,
        ok ? 'info' : 'warn',
        ok ? '✓ Aprobado: el borrador queda listo para que lo envíes tú' : '✗ Rechazado: no se hace nada con el borrador',
      )
      return text(
        ok
          ? 'El usuario ha APROBADO el borrador. No lo envíes: el usuario lo enviará él mismo. La orden queda hecha; continúa con la siguiente.'
          : 'El usuario ha RECHAZADO el borrador. No hagas nada con él. Continúa con la siguiente orden o termina.',
      )
    },
  )

  return createSdkMcpServer({
    name: 'hq',
    version: '0.1.0',
    tools: [planOrders, updateOrder, requestApproval],
    // request_approval espera al usuario: le damos margen de sobra.
    timeout: DAY_MS,
  })
}
