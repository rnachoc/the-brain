// Coloca la etiqueta de cada sala en un hueco donde no pise ninguna sala, The Brain ni otra etiqueta.
import type { Project } from '../types'
import { iso, ROOM_D, ROOM_W, roomOrigin, WALL_H, type P3 } from './iso'

type Pt = [number, number]
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export const LABEL_H = 44
const GAP = 8

/** Silueta de una sala en pantalla (suelo + paredes del fondo). */
export function roomHull(gx: number, gy: number): Pt[] {
  const [x0, y0] = roomOrigin(gx, gy)
  const pts: P3[] = [
    [x0, y0 + ROOM_D, WALL_H],
    [x0, y0, WALL_H],
    [x0 + ROOM_W, y0, WALL_H],
    [x0 + ROOM_W, y0, -0.7],
    [x0 + ROOM_W, y0 + ROOM_D, -0.7],
    [x0, y0 + ROOM_D, -0.7],
  ]
  return pts.map((p) => iso(...p))
}

const rectPoly = (r: Rect): Pt[] => [
  [r.x, r.y],
  [r.x + r.w, r.y],
  [r.x + r.w, r.y + r.h],
  [r.x, r.y + r.h],
]

/** Separating Axis Theorem para dos polígonos convexos. */
function overlaps(a: Pt[], b: Pt[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i]
      const [x2, y2] = poly[(i + 1) % poly.length]
      const nx = y2 - y1
      const ny = x1 - x2
      const proj = (p: Pt[]) => p.map(([x, y]) => x * nx + y * ny)
      const pa = proj(a)
      const pb = proj(b)
      if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false
    }
  }
  return true
}

export const labelWidth = (p: Project) => Math.round(96 + p.name.length * 8)

export function placeLabels(rooms: { p: Project; gx: number; gy: number }[]): Map<string, Rect> {
  const obstacles: Pt[][] = rooms.map((r) => roomHull(r.gx, r.gy))
  // The Brain y su etiqueta, en el centro.
  obstacles.push(rectPoly({ x: -95, y: -110, w: 190, h: 175 }))

  const out = new Map<string, Rect>()
  for (const { p, gx, gy } of rooms) {
    const [x0, y0] = roomOrigin(gx, gy)
    const w = labelWidth(p)
    const front = iso(x0 + ROOM_W, y0 + ROOM_D, -0.7)
    const back = iso(x0, y0, WALL_H)
    const right = iso(x0 + ROOM_W, y0, WALL_H / 2)
    const left = iso(x0, y0 + ROOM_D, WALL_H / 2)
    // Preferencia: debajo (deslizándose a los lados si choca), luego encima, y solo al final a un lado.
    const shifts = [0, ...Array.from({ length: 8 }, (_, i) => (i + 1) * 15).flatMap((d) => [d, -d])]
    const candidates: Rect[] = [
      ...shifts.map((dx) => ({ x: front[0] - w / 2 + dx, y: front[1] + GAP, w, h: LABEL_H })),
      ...shifts.map((dx) => ({ x: back[0] - w / 2 + dx, y: back[1] - GAP - LABEL_H, w, h: LABEL_H })),
      { x: right[0] + GAP, y: right[1] - LABEL_H / 2, w, h: LABEL_H },
      { x: left[0] - GAP - w, y: left[1] - LABEL_H / 2, w, h: LABEL_H },
    ]
    const free = candidates.find((c) => obstacles.every((o) => !overlaps(rectPoly(c), o))) ?? candidates[0]
    out.set(p.id, free)
    obstacles.push(rectPoly(free))
  }
  return out
}
