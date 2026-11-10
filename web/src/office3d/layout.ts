// Distribución del edificio a partir de los proyectos. Función pura, sin three.
// Unidad = 1 metro. x: izquierda → derecha, y: arriba, z: hacia la cámara.
//
// Prueba manual: con 6 proyectos sin department (uno fallback) salen 3 plantas:
// atrio con el fallback, 5 salas (PB izq/der, P1 izq/der, P2 izq) y una sala común en P2 der.
// Con un department de 5 o más empleados, ocupa una planta entera (side: 'full').
import type { Project } from '../types'

export const ROOM_W = 9
export const ROOM_D = 6
export const ROOM_H = 3.2
export const SLAB = 0.25
export const CORE_W = 5
export const FLOOR_H = ROOM_H + SLAB
export const HALF_W = CORE_W / 2 + ROOM_W
export const TOWER = { w: 6, d: 4.4, h: 3 }

export type Side = 'left' | 'right' | 'full' | 'atrium' | 'tower'

export interface Seat {
  projectId: string
  x: number
  z: number
  /** Giro en y del puesto: el empleado mira hacia +z girado este ángulo. */
  rot: number
}

export interface RoomLayout {
  id: string
  name: string
  floor: number
  side: Side
  x0: number
  x1: number
  /** Cota del suelo de la sala. */
  y: number
  color: string
  projectIds: string[]
  seats: Seat[]
  /** Sala sin departamento: se amuebla como zona común. */
  lounge?: boolean
}

export interface OfficeLayout {
  rooms: RoomLayout[]
  atrium: RoomLayout
  tower: RoomLayout
  floors: number
  /** Cota de la cubierta. */
  roofY: number
  chief: { x: number; z: number }
  seatOf: Map<string, { room: RoomLayout; seat: Seat }>
}

interface Dept {
  name: string
  projects: Project[]
}

const floorY = (f: number) => f * FLOOR_H + SLAB

const extents = (side: Side): [number, number] =>
  side === 'left' ? [-HALF_W, -CORE_W / 2] : side === 'right' ? [CORE_W / 2, HALF_W] : side === 'full' ? [-HALF_W, HALF_W] : [-CORE_W / 2, CORE_W / 2]

/** Puestos en filas mirando a la cámara en diagonal hacia el centro de la sala. */
function seatsFor(side: Side, x0: number, x1: number, ids: string[]): Seat[] {
  const n = ids.length
  if (!n) return []
  // Columnas: dos por ala; en una planta entera, dos en cada ala (el núcleo queda libre).
  const cols = side === 'full' ? [x0 + 2.3, x0 + 6.6, x1 - 6.6, x1 - 2.3] : [x0 + 2.4, x0 + 6.6]
  const rows = Math.max(2, Math.ceil(n / cols.length))
  const zs = Array.from({ length: rows }, (_, r) => (rows === 1 ? 0 : 1.3 - (r * 2.8) / (rows - 1)))
  const mid = (x0 + x1) / 2
  return ids.map((projectId, i) => {
    const x = cols[i % cols.length]
    const z = zs[Math.floor(i / cols.length)]
    return { projectId, x, z, rot: Math.max(-0.55, Math.min(0.55, (mid - x) * 0.12)) }
  })
}

export function buildLayout(projects: Project[]): OfficeLayout {
  const atriumIds = projects.filter((p) => p.fallback || p.department?.trim().toLowerCase() === 'atrio').slice(0, 2)
  const atriumSet = new Set(atriumIds.map((p) => p.id))

  // Departamentos en orden de aparición. Sin department: sala propia con su nombre.
  const byKey = new Map<string, Dept>()
  for (const p of projects) {
    if (atriumSet.has(p.id)) continue
    const name = p.department?.trim() || p.name
    const key = p.department?.trim() ? `d:${name}` : `p:${p.id}`
    if (!byKey.has(key)) byKey.set(key, { name, projects: [] })
    byKey.get(key)!.projects.push(p)
  }
  const depts = [...byKey.values()]

  // Huecos por planta: dos alas. Un departamento de más de 4 ocupa una planta entera.
  const slots: { floor: number; side: Side; dept?: Dept }[] = []
  const holes: { floor: number; side: Side }[] = []
  let floor = 0
  let side = 'left' as 'left' | 'right'
  const advance = () => (side === 'left' ? (side = 'right') : ((side = 'left'), floor++))
  for (const d of depts) {
    if (d.projects.length > 4) {
      if (side === 'right') holes.push({ floor, side: 'right' }), advance()
      slots.push({ floor, side: 'full', dept: d })
      floor++
      continue
    }
    const hole = holes.shift()
    if (hole) {
      slots.push({ ...hole, dept: d })
      continue
    }
    slots.push({ floor, side, dept: d })
    advance()
  }
  for (const h of holes) slots.push(h)
  if (side === 'right') slots.push({ floor, side: 'right' }), floor++
  if (!slots.length) slots.push({ floor: 0, side: 'left' }, { floor: 0, side: 'right' }), floor++
  const floors = Math.max(1, floor)

  const rooms: RoomLayout[] = slots.map((s) => {
    const [x0, x1] = extents(s.side)
    const ids = s.dept?.projects.map((p) => p.id) ?? []
    return {
      id: s.dept ? `room:${s.dept.name}:${s.floor}` : `lounge:${s.floor}:${s.side}`,
      name: s.dept?.name ?? 'Sala común',
      floor: s.floor,
      side: s.side,
      x0,
      x1,
      y: floorY(s.floor),
      color: s.dept?.projects[0]?.color ?? '#94a3b8',
      projectIds: ids,
      seats: seatsFor(s.side, x0, x1, ids),
      lounge: !s.dept,
    }
  })

  const [ax0, ax1] = extents('atrium')
  const atrium: RoomLayout = {
    id: 'atrium',
    name: 'Atrio',
    floor: 0,
    side: 'atrium',
    x0: ax0,
    x1: ax1,
    y: floorY(0),
    color: atriumIds[0]?.color ?? '#94a3b8',
    projectIds: atriumIds.map((p) => p.id),
    seats: atriumIds.map((p, i) => ({ projectId: p.id, x: i ? -1.2 : 1.1, z: i ? 1.6 : 0.4, rot: -0.35 })),
  }

  const roofY = floors * FLOOR_H + SLAB
  const tower: RoomLayout = {
    id: 'tower',
    name: 'The Brain',
    floor: floors,
    side: 'tower',
    x0: -TOWER.w / 2,
    x1: TOWER.w / 2,
    y: roofY,
    color: '#a78bfa',
    projectIds: [],
    seats: [],
  }

  const seatOf = new Map<string, { room: RoomLayout; seat: Seat }>()
  for (const room of [atrium, ...rooms]) for (const seat of room.seats) seatOf.set(seat.projectId, { room, seat })

  return { rooms, atrium, tower, floors, roofY, chief: { x: -0.9, z: 0.9 }, seatOf }
}

/** "Planta baja · Ventas", "Piso 2 · Marketing", "Atrio", "Torre · The Brain". */
export function roomLabel(r: RoomLayout): string {
  if (r.side === 'atrium') return 'Atrio'
  if (r.side === 'tower') return `Torre · ${r.name}`
  return `${r.floor === 0 ? 'Planta baja' : `Piso ${r.floor}`} · ${r.name}`
}
