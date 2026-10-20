// Proyección isométrica en SVG: (x, y) en el suelo, z hacia arriba.
export const U = 14
const C = Math.cos(Math.PI / 6) * U
const S = 0.5 * U

export type P3 = [number, number, number]

export function iso(x: number, y: number, z = 0): [number, number] {
  return [(x - y) * C, (x + y) * S - z * U]
}

export const poly = (pts: P3[]) => pts.map((p) => iso(...p).join(',')).join(' ')

/** Caja: devuelve cara superior, frontal-izquierda (+y) y frontal-derecha (+x). */
export function box(x: number, y: number, z: number, w: number, d: number, h: number) {
  return {
    top: poly([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]]),
    left: poly([[x, y + d, z + h], [x + w, y + d, z + h], [x + w, y + d, z], [x, y + d, z]]),
    right: poly([[x + w, y, z + h], [x + w, y + d, z + h], [x + w, y + d, z], [x + w, y, z]]),
  }
}

// Geometría de las salas
export const ROOM_W = 10
export const ROOM_D = 10
export const WALL_H = 4
export const PITCH = 17

// Hexágono alrededor del Brain (sentido horario desde arriba-izquierda), luego
// arriba/abajo, y después un segundo anillo para cuando haya más proyectos.
const HEX: [number, number][] = [[-1, 0], [0, -1], [1, -1], [1, 0], [0, 1], [-1, 1]]
const EXTRA: [number, number][] = [[-1, -1], [1, 1]]

function ring2(): [number, number][] {
  const out: [number, number][] = []
  for (let gx = -2; gx <= 2; gx++)
    for (let gy = -2; gy <= 2; gy++) if (Math.max(Math.abs(gx), Math.abs(gy)) === 2) out.push([gx, gy])
  const angle = ([gx, gy]: [number, number]) => {
    const [px, py] = iso(gx, gy)
    return (Math.atan2(py, px) + Math.PI * 2.75) % (Math.PI * 2)
  }
  return out.sort((a, b) => angle(a) - angle(b))
}

const SLOTS = [...HEX, ...EXTRA, ...ring2()]

export const slotFor = (i: number) => SLOTS[i % SLOTS.length]

export const roomOrigin = (gx: number, gy: number): [number, number] => [
  gx * PITCH - ROOM_W / 2,
  gy * PITCH - ROOM_D / 2,
]
