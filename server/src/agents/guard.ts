// Guardas de seguridad: qué puede hacer un agente con sus herramientas.
import { basename, isAbsolute, relative, resolve } from 'node:path'
import type { CanUseTool } from '@anthropic-ai/claude-agent-sdk'
import type { Project } from '../../../shared/types'

const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit'])
const READ_TOOLS = new Set(['Read', 'Glob', 'Grep'])

/** Comandos que borran, envían o publican algo. */
const DANGEROUS =
  /\b(rm|rmdir|del|erase|rd|Remove-Item|shred|unlink|format|mkfs|git\s+push|git\s+reset\s+--hard|git\s+clean|npm\s+publish|curl|wget|Invoke-WebRequest|Invoke-RestMethod|scp|ssh|sendmail|mail)\b/i

/** Ningún agente lee ni escribe secretos: .env, .env.local, .env.production… */
const ENV_FILE = /^\.env(\..*)?$/i
const ENV_IN_TEXT = /(^|[\s/\\'"=*])\.env(\b|$)/i
const isEnvPath = (p: unknown) => typeof p === 'string' && ENV_FILE.test(basename(p.replace(/\\/g, '/')))

/**
 * Las acciones del proyecto (p. ej. "npm run publish") solo las lanza el servidor tras tu aprobación.
 * Bloqueamos sus tres primeras palabras para que el agente no pueda ejecutarlas por su cuenta.
 */
function actionCommands(project: Project): string[] {
  return (project.actions ?? []).map((a) => a.command.trim().split(/\s+/).slice(0, 3).join(' ').toLowerCase()).filter(Boolean)
}

/** Reglas que el SDK aplica antes incluso de preguntar. */
export const DISALLOWED_PATTERNS = [
  'Bash(rm:*)',
  'Bash(rmdir:*)',
  'Bash(del:*)',
  'Bash(git push:*)',
  'Bash(curl:*)',
  'Bash(wget:*)',
]

function inside(path: unknown, ...dirs: string[]): boolean {
  if (typeof path !== 'string' || !path) return false
  return dirs.some((dir) => {
    const rel = relative(dir, resolve(dir, path))
    return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
  })
}

export function makeGuard(
  project: Project,
  cwd: string,
  readDirs: string[],
  onDeny: (tool: string, reason: string, input: Record<string, unknown>) => void,
): CanUseTool {
  return async (toolName, input) => {
    const deny = (message: string) => {
      onDeny(toolName, message, input)
      return { behavior: 'deny' as const, message }
    }

    if (toolName.startsWith('mcp__hq__')) return { behavior: 'allow', updatedInput: input }
    if (!project.tools.includes(toolName)) return deny(`La herramienta ${toolName} no está permitida para este agente.`)

    if (
      (WRITE_TOOLS.has(toolName) || READ_TOOLS.has(toolName)) &&
      [input.file_path, input.notebook_path, input.path, input.pattern, input.glob].some((v) => isEnvPath(v) || (typeof v === 'string' && ENV_IN_TEXT.test(v)))
    )
      return deny('Los archivos .env tienen secretos: ningún agente puede leerlos ni escribirlos.')

    if (WRITE_TOOLS.has(toolName) && !inside(input.file_path ?? input.notebook_path, cwd))
      return deny(`Solo puedes escribir dentro de tu carpeta de trabajo (${cwd}).`)

    if (READ_TOOLS.has(toolName)) {
      const target = input.file_path ?? input.path
      if (target !== undefined && !inside(target, cwd, ...readDirs))
        return deny('Solo puedes leer tu carpeta de trabajo y /brain.')
    }

    if (toolName === 'Bash') {
      const cmd = String(input.command ?? '')
      if (DANGEROUS.test(cmd))
        return deny('Comando bloqueado: puede borrar archivos o enviar algo fuera. Déjalo como borrador y pide aprobación.')
      if (ENV_IN_TEXT.test(cmd)) return deny('Los archivos .env tienen secretos: ningún agente puede leerlos.')
      const flat = cmd.replace(/\s+/g, ' ').toLowerCase()
      if (actionCommands(project).some((a) => flat.includes(a)))
        return deny('Ese comando es una acción del proyecto: solo la ejecuta The Brain cuando tú la apruebas. Pide aprobación con request_approval.')
    }

    return { behavior: 'allow', updatedInput: input }
  }
}
