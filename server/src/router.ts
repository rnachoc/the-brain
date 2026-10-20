// Decide a qué proyecto(s) va cada mensaje.
// 1) @menciones explícitas se respetan tal cual.
// 2) Si hay API key, un modelo rápido clasifica y reparte la petición por proyecto.
// 3) Sin API key (o si la llamada falla), enrutado por palabras clave.
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import type { Project } from '../../shared/types'
import type { AppConfig } from './config'

export type RouteDecision =
  | { kind: 'dispatch'; targets: { projectId: string; prompt: string }[]; via: 'mention' | 'model' | 'keywords' }
  | { kind: 'ask'; question: string; prompt: string; options: string[] }

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

export function parseMentions(text: string, projects: Project[]): { ids: string[]; rest: string } {
  const ids = new Set<string>()
  const rest = text.replace(/(^|\s)@([\p{L}\w-]+)/gu, (m, sp: string, alias: string) => {
    const a = norm(alias)
    const p = projects.find((p) => p.id === a || p.aliases.some((x) => norm(x) === a))
    if (!p) return m
    ids.add(p.id)
    return sp
  })
  return { ids: [...ids], rest: rest.replace(/\s+/g, ' ').trim() }
}

function routeByKeywords(text: string, projects: Project[]): string[] {
  const t = norm(text)
  return projects
    .filter((p) => !p.fallback)
    .map((p) => ({ id: p.id, score: p.keywords.filter((k) => new RegExp(`\\b${norm(k)}\\b`).test(t)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.id)
}

function routerSystemPrompt(projects: Project[]): string {
  const list = projects
    .map(
      (p) =>
        `- id: "${p.id}" · ${p.name}${p.fallback ? ' (respaldo: solo si no encaja en ningún otro)' : ''}\n  ${p.description}\n  pistas: ${p.keywords.join(', ') || '—'}`,
    )
    .join('\n')
  return `Eres el router de un panel que reparte peticiones entre agentes, uno por proyecto.

Proyectos disponibles:
${list}

Para cada mensaje del usuario:
- Elige el proyecto o proyectos a los que pertenece. Si afecta a varios, devuelve un target por proyecto, cada uno con solo la parte de la petición que le toca, reescrita como una instrucción clara y autocontenida en el idioma del usuario.
- Si no puedes saber con razonable seguridad a qué proyecto va, pon ambiguous = true y escribe en "question" una sola línea corta preguntando al usuario para qué proyecto es. En ese caso targets puede ir vacío.
- Si no es ambiguo, deja "question" como cadena vacía.`
}

export async function route(text: string, config: AppConfig, client: Anthropic | null): Promise<RouteDecision> {
  const { projects } = config
  const askAll = (q: string, prompt: string): RouteDecision => ({
    kind: 'ask',
    question: q,
    prompt,
    options: projects.map((p) => p.id),
  })

  const { ids, rest } = parseMentions(text, projects)
  const prompt = rest || text.trim()
  const byMention = (): RouteDecision => ({
    kind: 'dispatch',
    via: 'mention',
    targets: ids.map((projectId) => ({ projectId, prompt })),
  })
  // Una sola mención: se respeta tal cual, sin llamar al modelo.
  if (ids.length === 1 || (ids.length > 1 && !client)) return byMention()

  if (client) {
    // Con varias menciones el modelo solo reparte el texto entre esos proyectos.
    const candidates = ids.length ? projects.filter((p) => ids.includes(p.id)) : projects
    const projectIds = candidates.map((p) => p.id) as [string, ...string[]]
    const Decision = z.object({
      targets: z.array(z.object({ projectId: z.enum(projectIds), prompt: z.string() })),
      ambiguous: z.boolean(),
      question: z.string(),
    })
    const res = await client.messages.parse({
      model: config.defaults.routerModel,
      max_tokens: 4000,
      system: routerSystemPrompt(candidates),
      output_config: { effort: 'low', format: zodOutputFormat(Decision) },
      messages: [{ role: 'user', content: text }],
    })
    const d = res.parsed_output
    if (ids.length) {
      // Se respeta la elección del usuario: todos los mencionados reciben su parte.
      const parts = new Map(d?.targets.map((t) => [t.projectId, t.prompt]))
      return { kind: 'dispatch', via: 'mention', targets: ids.map((id) => ({ projectId: id, prompt: parts.get(id) || prompt })) }
    }
    if (d && !d.ambiguous && d.targets.length) return { kind: 'dispatch', via: 'model', targets: d.targets }
    return askAll(d?.question || 'No tengo claro a qué proyecto va. ¿Para cuál es?', prompt)
  }

  const matched = routeByKeywords(text, projects)
  if (!matched.length) return askAll('No tengo claro a qué proyecto va. ¿Para cuál es?', prompt)
  return { kind: 'dispatch', via: 'keywords', targets: matched.map((projectId) => ({ projectId, prompt })) }
}
