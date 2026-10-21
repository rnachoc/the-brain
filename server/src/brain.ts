// The Brain: notas markdown compartidas en brain/, en disco y fuera del repo.
// Nunca se borra nada: antes de sobrescribir una nota se guarda una copia en brain/.history/.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import type { BrainNote, Project } from '../../shared/types'
import { BRAIN_DIR } from './config'

const HISTORY = join(BRAIN_DIR, '.history')
const authors = new Map<string, string>()

/** Ruta relativa segura dentro de brain/ (solo .md, sin salir de la carpeta ni tocar el historial). */
export function safeNotePath(path: string): string | null {
  const clean = path.trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/^brain\//, '')
  if (!clean.endsWith('.md') || clean.startsWith('.history')) return null
  const abs = resolve(BRAIN_DIR, clean)
  const rel = relative(BRAIN_DIR, abs)
  if (!rel || rel.startsWith('..') || resolve(abs) !== abs) return null
  return rel.split(sep).join('/')
}

function readNote(rel: string): BrainNote {
  const abs = join(BRAIN_DIR, rel)
  return {
    path: rel,
    content: readFileSync(abs, 'utf8'),
    updatedAt: statSync(abs).mtimeMs,
    updatedBy: authors.get(rel) ?? 'tú',
  }
}

export function listNotes(): BrainNote[] {
  const out: BrainNote[] = []
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue
      const abs = join(dir, e.name)
      if (e.isDirectory()) walk(abs)
      else if (e.name.endsWith('.md')) out.push(readNote(relative(BRAIN_DIR, abs).split(sep).join('/')))
    }
  }
  if (existsSync(BRAIN_DIR)) walk(BRAIN_DIR)
  return out.sort((a, b) => a.path.localeCompare(b.path))
}

export function getNote(path: string): BrainNote | null {
  const rel = safeNotePath(path)
  return rel && existsSync(join(BRAIN_DIR, rel)) ? readNote(rel) : null
}

/** Escribe una nota guardando antes la versión anterior. Devuelve null si la ruta no es válida. */
export function writeNote(path: string, content: string, by: string): BrainNote | null {
  const rel = safeNotePath(path)
  if (!rel) return null
  const abs = join(BRAIN_DIR, rel)
  if (existsSync(abs)) {
    const prev = readFileSync(abs, 'utf8')
    if (prev === content) return readNote(rel)
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backup = join(HISTORY, `${rel.replace(/\.md$/, '')}.${stamp}.md`)
    mkdirSync(dirname(backup), { recursive: true })
    writeFileSync(backup, prev)
  }
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content)
  authors.set(rel, by)
  return readNote(rel)
}

/** Crea la estructura base la primera vez (no toca lo que ya exista). */
export function ensureBrain(projects: Project[]) {
  mkdirSync(BRAIN_DIR, { recursive: true })
  const seed: Record<string, string> = {
    'index.md': `# The Brain

Memoria compartida de todos los agentes. Cada agente la lee al empezar y escribe aquí lo que aprende.

## Convenciones
- **perfil.md** → quién eres y cómo te gusta trabajar.
- **decisiones.md** → decisiones tomadas (con fecha).
- **proyectos/<id>.md** → datos estables de cada proyecto.

> Los agentes nunca borran notas: solo añaden o editan, y cada edición guarda una copia en .history/.
`,
    'perfil.md': `# Perfil

Rellena esta nota para que todos los agentes te conozcan:

- A qué te dedicas y qué buscas.
- Idioma y tono preferidos.
- Cosas que los agentes nunca deben hacer.
`,
    'decisiones.md': `# Decisiones\n\n`,
  }
  for (const p of projects) if (!p.fallback) seed[`proyectos/${p.id}.md`] = `# ${p.name}\n\n${p.description}\n\n`
  for (const [rel, content] of Object.entries(seed)) {
    const abs = join(BRAIN_DIR, rel)
    if (!existsSync(abs)) {
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, content)
    }
  }
}

/** Lo que cada agente recibe del Brain al empezar. */
export function brainContext(project: Project): string {
  const parts = ['index.md', 'perfil.md', `proyectos/${project.id}.md`]
    .map((p) => getNote(p))
    .filter((n): n is BrainNote => !!n)
    .map((n) => `### brain/${n.path}\n${n.content.trim()}`)
  const others = listNotes()
    .map((n) => n.path)
    .filter((p) => !['index.md', 'perfil.md', `proyectos/${project.id}.md`].includes(p))
  return `${parts.join('\n\n')}${others.length ? `\n\nOtras notas disponibles (léelas con Read si las necesitas): ${others.join(', ')}` : ''}`
}
