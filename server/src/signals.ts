// Señales de proyecto (<folder>/.brain/status.json) y archivos que enlazan (informe e imagen).
// Las escribe cada proyecto; The Brain solo las lee. Se revisan cada 60 s por fecha de modificación.
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { basename, extname, isAbsolute, join, relative, resolve } from 'node:path'
import type { Project, ProjectSignal } from '../../shared/types'
import { loadConfig, ROOT } from './config'

const TICK_MS = 60_000
const TONES = new Set(['ok', 'warn', 'error'])

const signals = new Map<string, ProjectSignal>()
const seen = new Map<string, number>()

const folderOf = (p: Project) => resolve(ROOT, p.folder)
const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : undefined)

function readSignal(file: string, mtime: number): ProjectSignal | null {
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
    const items = Array.isArray(raw.items) ? raw.items : []
    return {
      updatedAt: str(raw.updatedAt, 40) ?? new Date(mtime).toISOString(),
      headline: str(raw.headline) ?? '',
      tone: TONES.has(raw.tone as string) ? (raw.tone as ProjectSignal['tone']) : 'ok',
      items: items.slice(0, 6).flatMap((it) => {
        const i = it as Record<string, unknown>
        const label = str(i?.label, 60)
        const value = typeof i?.value === 'number' ? String(i.value) : str(i?.value, 60)
        return label && value ? [{ label, value, delta: str(i.delta, 20) }] : []
      }),
      report: str(raw.report, 300),
      image: str(raw.image, 300),
      mtime,
    }
  } catch {
    return null
  }
}

/** Revisa los status.json y devuelve los proyectos cuya señal ha cambiado. */
export function scanSignals(): { projectId: string; signal: ProjectSignal | null }[] {
  const changed: { projectId: string; signal: ProjectSignal | null }[] = []
  for (const p of loadConfig().projects) {
    const file = join(folderOf(p), '.brain', 'status.json')
    const mtime = existsSync(file) ? statSync(file).mtimeMs : 0
    if (seen.get(p.id) === mtime) continue
    seen.set(p.id, mtime)
    const signal = mtime ? readSignal(file, mtime) : null
    if (signal) signals.set(p.id, signal)
    else signals.delete(p.id)
    changed.push({ projectId: p.id, signal })
  }
  return changed
}

export const currentSignals = () => Object.fromEntries(signals)

export function startSignals(onChange: (projectId: string, signal: ProjectSignal | null) => void) {
  scanSignals()
  setInterval(() => {
    for (const c of scanSignals()) onChange(c.projectId, c.signal)
  }, TICK_MS)
}

const ALLOWED = new Set(['.md', '.jpg', '.jpeg', '.png'])

/**
 * Ruta segura de un archivo enlazado por la señal: dentro de la carpeta del proyecto,
 * solo Markdown o imagen y nunca .env*. Devuelve null si no vale.
 */
export function safeProjectFile(p: Project, path: string): string | null {
  const dir = folderOf(p)
  const clean = path.trim().replace(/\\/g, '/')
  if (!clean || isAbsolute(clean) || /^\.env/i.test(basename(clean)) || !ALLOWED.has(extname(clean).toLowerCase())) return null
  const abs = resolve(dir, clean)
  const rel = relative(dir, abs)
  if (!rel || rel.startsWith('..') || isAbsolute(rel) || !existsSync(abs)) return null
  // Un enlace simbólico no puede sacar la ruta de la carpeta.
  const real = relative(realpathSync(dir), realpathSync(abs))
  if (real.startsWith('..') || isAbsolute(real)) return null
  return abs
}
