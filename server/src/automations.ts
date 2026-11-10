// Tareas programadas de Claude Desktop: solo lectura. Cada tarea es una carpeta con un SKILL.md
// cuyo frontmatter trae name y description (el horario no está ahí: se gestiona en la app de Claude).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { ClaudeTask } from '../../shared/types'
import { loadConfig } from './config'

function frontmatter(text: string): { meta: Record<string, string>; body: string } {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!m) return { meta: {}, body: text }
  const meta: Record<string, string> = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/)
    if (kv) meta[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '')
  }
  return { meta, body: m[2] }
}

export function listClaudeTasks(): ClaudeTask[] {
  const dir = loadConfig().office.claudeScheduledTasksDir
  if (!existsSync(dir)) return []
  const tasks: ClaudeTask[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const file = join(dir, entry.name, 'SKILL.md')
    if (!existsSync(file)) continue
    const { meta, body } = frontmatter(readFileSync(file, 'utf8'))
    tasks.push({
      id: entry.name,
      name: meta.name || entry.name,
      description: meta.description ?? '',
      updatedAt: statSync(file).mtimeMs,
      body: body.trim().slice(0, 20_000),
    })
  }
  return tasks.sort((a, b) => a.name.localeCompare(b.name))
}
