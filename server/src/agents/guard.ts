// Guardas de seguridad: qué puede hacer un agente con sus herramientas.
import { isAbsolute, relative, resolve } from 'node:path'
import type { CanUseTool } from '@anthropic-ai/claude-agent-sdk'
import type { Project } from '../../../shared/types'

const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit'])
const READ_TOOLS = new Set(['Read', 'Glob', 'Grep'])

/** Comandos que borran, envían o publican algo. */
const DANGEROUS =
  /\b(rm|rmdir|del|erase|rd|Remove-Item|shred|unlink|format|mkfs|git\s+push|git\s+reset\s+--hard|git\s+clean|npm\s+publish|curl|wget|Invoke-WebRequest|Invoke-RestMethod|scp|ssh|sendmail|mail)\b/i

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

    if (WRITE_TOOLS.has(toolName) && !inside(input.file_path ?? input.notebook_path, cwd))
      return deny(`Solo puedes escribir dentro de tu carpeta de trabajo (${cwd}).`)

    if (READ_TOOLS.has(toolName)) {
      const target = input.file_path ?? input.path
      if (target !== undefined && !inside(target, cwd, ...readDirs))
        return deny('Solo puedes leer tu carpeta de trabajo y /brain.')
    }

    if (toolName === 'Bash' && DANGEROUS.test(String(input.command ?? '')))
      return deny('Comando bloqueado: puede borrar archivos o enviar algo fuera. Déjalo como borrador y pide aprobación.')

    return { behavior: 'allow', updatedInput: input }
  }
}
