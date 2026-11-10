// Aspecto estable de cada empleado a partir de su id. La ropa toma el color del proyecto.
import * as THREE from 'three'
import { projects } from '../config'
import type { Project } from '../types'
import { canvasTexture, seeded } from './kit'

export interface Look {
  skin: string
  hair: string
  hairStyle: 0 | 1 | 2 | 3
  glasses: boolean
  shirt: string
  pants: string
  shoes: string
}

const SKINS = ['#f2c9a0', '#e8b58a', '#c98e62', '#a8714a', '#7a4e33', '#f5d6b8']
const HAIRS = ['#2a1d15', '#4a3121', '#7a4a26', '#c9a35a', '#1c1c1c', '#8a3b22', '#d9d2c5']
const PANTS = ['#2f3542', '#3b4a63', '#4a4036', '#24292f', '#5b6170']
const NAMES = ['Tomás', 'Lucía', 'Bruno', 'Valeria', 'Nico', 'Irene', 'Hugo', 'Marta', 'Leo', 'Carla', 'Álex', 'Noa', 'Mateo', 'Sara', 'Dani', 'Julia', 'Pablo', 'Elena', 'Gael', 'Vera']

export function lookFor(id: string, color: string): Look {
  const r = seeded(id)
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]
  return {
    skin: pick(SKINS),
    hair: pick(HAIRS),
    hairStyle: Math.floor(r() * 4) as Look['hairStyle'],
    glasses: r() < 0.35,
    shirt: color,
    pants: pick(PANTS),
    shoes: '#1f2023',
  }
}

/** Jefe de gabinete: chaqueta naranja y gafas. */
export const CHIEF_LOOK: Look = {
  skin: '#f2c9a0',
  hair: '#1f1712',
  hairStyle: 2,
  glasses: true,
  shirt: '#ea7a2a',
  pants: '#2f3542',
  shoes: '#1f2023',
}

// Nombres por defecto: estables a partir del id y sin repetir dentro de la oficina.
const defaultNames = new Map<string, string>()
{
  const used = new Set(projects.map((p) => p.agentName?.trim()).filter(Boolean))
  for (const p of projects) {
    if (p.agentName?.trim()) continue
    let i = Math.floor(seeded(`name:${p.id}`)() * NAMES.length)
    for (let n = 0; n < NAMES.length && used.has(NAMES[i]); n++) i = (i + 1) % NAMES.length
    used.add(NAMES[i])
    defaultNames.set(p.id, NAMES[i])
  }
}

/** Nombre del empleado: el de config.json o uno estable a partir del id. */
export function employeeName(p: Project): string {
  return p.agentName?.trim() || defaultNames.get(p.id) || NAMES[0]
}

export const employeeRole = (p: Project) => p.role?.trim() || p.name

const faces = new Map<string, THREE.Material>()

/** Material de la cara (ojos, boca y gafas pintados en un canvas pequeño). */
export function faceMaterial(look: Look): THREE.Material {
  const key = `${look.skin}|${look.glasses}`
  let m = faces.get(key)
  if (!m) {
    const tex = canvasTexture(64, 64, (ctx) => {
      ctx.fillStyle = look.skin
      ctx.fillRect(0, 0, 64, 64)
      ctx.fillStyle = '#1b1b1f'
      ctx.fillRect(17, 28, 7, 8)
      ctx.fillRect(40, 28, 7, 8)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(18, 29, 2, 2)
      ctx.fillRect(41, 29, 2, 2)
      ctx.fillStyle = '#8a4a3a'
      ctx.fillRect(25, 46, 14, 3)
      if (look.glasses) {
        ctx.strokeStyle = '#1b1b1f'
        ctx.lineWidth = 3
        ctx.strokeRect(12, 23, 17, 17)
        ctx.strokeRect(35, 23, 17, 17)
        ctx.beginPath()
        ctx.moveTo(29, 30)
        ctx.lineTo(35, 30)
        ctx.stroke()
      }
    })
    tex.magFilter = THREE.NearestFilter
    m = new THREE.MeshLambertMaterial({ map: tex })
    faces.set(key, m)
  }
  return m
}
