import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Project } from '../../shared/types'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const BRAIN_DIR = join(ROOT, 'brain')
export const DATA_DIR = join(ROOT, 'data')

interface RawConfig {
  defaults: { model: string; routerModel: string; tools: string[] }
  projects: (Partial<Project> & Pick<Project, 'id' | 'name' | 'color'>)[]
}

export interface AppConfig {
  defaults: RawConfig['defaults']
  projects: Project[]
}

/** Se lee en cada uso para que editar config.json no requiera reiniciar. */
export function loadConfig(): AppConfig {
  const file = join(ROOT, 'config.json')
  if (!existsSync(file)) copyFileSync(join(ROOT, 'config.example.json'), file)
  const raw = JSON.parse(readFileSync(file, 'utf8')) as RawConfig
  return {
    defaults: raw.defaults,
    projects: raw.projects.map((p) => ({
      aliases: [p.id],
      icon: '🤖',
      agents: 1,
      folder: `workspaces/${p.id}`,
      description: '',
      keywords: [],
      tools: raw.defaults.tools,
      systemPrompt: '',
      ...p,
    })),
  }
}

export function projectFolder(p: Project): string {
  const dir = resolve(ROOT, p.folder)
  mkdirSync(dir, { recursive: true })
  return dir
}

export const hasApiKey = () => !!process.env.ANTHROPIC_API_KEY?.trim()
