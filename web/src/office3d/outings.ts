// Salidas a la piscina: reserva de sitios y ruta a pie desde el puesto hasta el jardín.
// La ruta baja por la escalera en U del núcleo, tramo a tramo, y sale por la fachada.
import * as THREE from 'three'
import { CORE_W, flightDir, flightZ, floorTop, POOL, STAIR_X, type RoomLayout } from './layout'

export type Activity =
  | { kind: 'lounge'; slot: string; pos: THREE.Vector3; yaw: number }
  | { kind: 'swim'; slot: string; lane: number; entry: THREE.Vector3 }
  | { kind: 'chat'; slot: string; pos: THREE.Vector3; yaw: number }

const taken = new Set<string>()
/** Como mucho unos pocos fuera a la vez, para que la oficina no se vacíe. */
const MAX_OUT = 5

export const release = (slot: string) => taken.delete(slot)

/** Reserva un sitio libre en la piscina, o null si está todo ocupado. */
export function claimActivity(): Activity | null {
  if (taken.size >= MAX_OUT) return null
  const options: Activity[] = []
  POOL.loungers.forEach((l, i) => {
    // De pie en la tumbona y tumbado boca arriba, con los pies hacia el agua.
    const feet = new THREE.Vector3(0, 0.52, 0.8).applyAxisAngle(new THREE.Vector3(0, 1, 0), l.rot).add(new THREE.Vector3(l.x, 0, l.z))
    options.push({ kind: 'lounge', slot: `lounger-${i}`, pos: feet, yaw: l.rot })
  })
  POOL.lanes.forEach((z, i) => options.push({ kind: 'swim', slot: `lane-${i}`, lane: z, entry: new THREE.Vector3(POOL.x0 + 1.5 + i * 3, 0, 4.45) }))
  POOL.edge.forEach((e, i) => options.push({ kind: 'chat', slot: `edge-${i}`, pos: new THREE.Vector3(e.x, 0, e.z), yaw: e.yaw }))
  const free = options.filter((o) => !taken.has(o.slot))
  if (!free.length) return null
  const a = free[Math.floor(Math.random() * free.length)]
  taken.add(a.slot)
  return a
}

/** Punto del borde desde el que se entra a la actividad. */
export function approachOf(a: Activity): THREE.Vector3 {
  if (a.kind === 'swim') return a.entry
  if (a.kind === 'chat') return a.pos
  return new THREE.Vector3(a.pos.x - 0.8, 0, a.pos.z - 0.2)
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

/**
 * Ruta del puesto (en su posición de pie) hasta la salida al jardín y de ahí al sitio de la actividad.
 * Plantas altas: pasillo central → arranque del tramo → bajar tramo a tramo → atrio → fachada.
 */
export function routeOut(room: RoomLayout, home: THREE.Vector3, target: THREE.Vector3): THREE.Vector3[] {
  const pts: THREE.Vector3[] = []
  const f = room.floor
  const yf = floorTop(f)
  // Pasillo entre las dos filas de mesas.
  pts.push(v(home.x, yf, 0.15))
  let exitX = home.x
  if (f > 0) {
    // El tramo f-1 llega a esta planta por x = dir·STAIR_X; nos acercamos desde fuera del núcleo.
    const g = f - 1
    const topX = flightDir(g) * STAIR_X
    const sideX = flightDir(g) * (CORE_W / 2 + 0.45)
    pts.push(v(sideX, yf, 0.15), v(sideX, yf, flightZ(g)), v(topX, yf, flightZ(g)))
    for (let k = g; k >= 0; k--) {
      const bottomX = -flightDir(k) * STAIR_X
      pts.push(v(bottomX, floorTop(k), flightZ(k)))
      // Rellano: cambio de carril para el tramo siguiente.
      if (k > 0) pts.push(v(bottomX, floorTop(k), flightZ(k - 1)))
    }
    // Planta baja: del pie de la escalera a la fachada por el lateral del atrio.
    exitX = -flightDir(0) * (CORE_W / 2 - 0.25)
    pts.push(v(exitX, floorTop(0), -1.2))
  }
  pts.push(v(exitX, floorTop(0), 2.95), v(exitX, 0, 3.9))
  // Por delante de la piscina hasta el sitio.
  pts.push(v(target.x, 0, 3.9), target.clone())
  return pts
}
