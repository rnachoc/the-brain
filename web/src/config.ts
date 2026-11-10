import raw from '../../config.json'
import type { Project } from './types'

type RawProject = Partial<Project> & Pick<Project, 'id' | 'name' | 'color'>

const defaults = raw.defaults

export const projects: Project[] = (raw.projects as RawProject[]).map((p) => ({
  aliases: [p.id],
  icon: '🤖',
  agents: 1,
  folder: `workspaces/${p.id}`,
  description: '',
  keywords: [],
  tools: defaults.tools,
  systemPrompt: '',
  ...p,
}))

const byId = new Map(projects.map((p) => [p.id, p]))

export function projectById(id: string): Project {
  return byId.get(id) ?? fallbackProject()
}

export function fallbackProject(): Project {
  return projects.find((p) => p.fallback) ?? projects[0]
}

interface OfficeConfig {
  title: string
  chief: { name: string; role: string }
}

const rawOffice = (raw as { office?: Partial<OfficeConfig> }).office ?? {}

/** Bloque `office` de config.json con sus valores por defecto. */
export const office: OfficeConfig = {
  title: rawOffice.title ?? 'Mi oficina de agentes de IA',
  chief: { name: 'Iris', role: 'Jefa de gabinete', ...rawOffice.chief },
}
