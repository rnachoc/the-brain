import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Project } from '../../shared/types'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const BRAIN_DIR = join(ROOT, 'brain')
export const DATA_DIR = join(ROOT, 'data')

interface RawConfig {
  defaults: { model: string; routerModel: string; tools: string[] }
  projects: (Partial<Project> & Pick<Project, 'id' | 'name' | 'color'>)[]
  office?: Partial<OfficeConfig>
}

export interface OfficeConfig {
  title: string
  chief: { name: string; role: string }
  /** Carpeta de las tareas programadas de Claude Desktop (solo lectura). */
  claudeScheduledTasksDir: string
}

export interface AppConfig {
  defaults: RawConfig['defaults']
  projects: Project[]
  office: OfficeConfig
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
    office: {
      title: raw.office?.title ?? 'Mi oficina de agentes de IA',
      chief: { name: 'Iris', role: 'Jefa de gabinete', ...raw.office?.chief },
      claudeScheduledTasksDir: expandHome(raw.office?.claudeScheduledTasksDir ?? '~/.claude/scheduled-tasks'),
    },
  }
}

const expandHome = (p: string) => (p === '~' || p.startsWith('~/') || p.startsWith('~\\') ? join(homedir(), p.slice(1)) : p)

/**
 * Carpeta de trabajo del proyecto. Las de workspaces/ se crean solas; una ruta absoluta
 * apunta a un repo tuyo y, si no existe, es un error de config.json: no la inventamos.
 */
export function projectFolder(p: Project): string {
  const dir = resolve(ROOT, p.folder)
  if (isAbsolute(p.folder) && !existsSync(dir))
    throw new Error(`La carpeta ${dir} no existe. Revisa "folder" de ${p.id} en config.json.`)
  mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Cómo se autentica Claude: con el token de tu suscripción (npm run login) o con una API key.
 * El Agent SDK lee ambas variables del entorno. Sin ninguna, todo funciona en modo simulado.
 */
export function claudeAuth(): 'subscription' | 'api_key' | null {
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN?.trim()) return 'subscription'
  if (process.env.ANTHROPIC_API_KEY?.trim()) return 'api_key'
  return null
}

export const hasClaude = () => claudeAuth() !== null

/** Entorno para Claude Code: con suscripción no le pasamos la API key, que tendría prioridad. */
export function agentEnv(): Record<string, string | undefined> {
  const env = { ...process.env }
  if (claudeAuth() === 'subscription') delete env.ANTHROPIC_API_KEY
  return env
}
