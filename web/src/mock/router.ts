// Enrutado simulado (fase a). En la fase b esto lo hace el router real en el servidor.
import { projects } from '../config'

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

export interface RouteResult {
  prompt: string
  projectIds: string[]
  question?: string
}

export function parseMentions(text: string): { ids: string[]; rest: string } {
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

export function routeMock(text: string): RouteResult {
  const { ids, rest } = parseMentions(text)
  const prompt = rest || text.trim()
  if (ids.length) return { prompt, projectIds: ids }

  const t = norm(text)
  const scored = projects
    .filter((p) => !p.fallback)
    .map((p) => ({
      id: p.id,
      score: p.keywords.filter((k) => new RegExp(`\\b${norm(k)}\\b`).test(t)).length,
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)

  if (!scored.length) {
    return { prompt, projectIds: [], question: 'No tengo claro a qué proyecto va. ¿Para cuál es?' }
  }
  return { prompt, projectIds: scored.map((s) => s.id) }
}
