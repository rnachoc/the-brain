// Cámara: vista general con órbita limitada, vuelo a sala y vuelo a empleado.
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { HALF_W, ROOM_H, type OfficeLayout, type RoomLayout, type Seat } from './layout'

export type Focus =
  | { kind: 'overview' }
  | { kind: 'room'; room: RoomLayout }
  | { kind: 'agent'; room: RoomLayout; x: number; z: number; rot: number }

interface View {
  target: THREE.Vector3
  az: number
  el: number
  dist: number
  /** Límites de la órbita del usuario alrededor de la vista. */
  azRange: number
  elMin: number
  elMax: number
}

const DEG = Math.PI / 180
export const FOV = 28

/** Distancia para que un rectángulo w × h quepa en pantalla. */
function fit(w: number, h: number, aspect: number) {
  const t = Math.tan((FOV / 2) * DEG)
  return Math.max(h / 2 / t, w / 2 / (t * aspect))
}

function viewFor(focus: Focus, layout: OfficeLayout, aspect: number): View {
  if (focus.kind === 'room') {
    const r = focus.room
    const cx = (r.x0 + r.x1) / 2
    const w = r.x1 - r.x0
    return {
      target: new THREE.Vector3(cx, r.y + 1.35, 0.3),
      az: -cx * 0.012,
      el: 11 * DEG,
      dist: fit(w + 3, ROOM_H + 2.4, aspect),
      azRange: 25 * DEG,
      elMin: 2 * DEG,
      elMax: 30 * DEG,
    }
  }
  if (focus.kind === 'agent') {
    const az = focus.rot * 0.7
    const dist = 4.6
    // El empleado queda a la izquierda del centro: desplazamos el objetivo a la derecha de la cámara.
    const right = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az)).multiplyScalar(Math.min(0.9, 0.35 * aspect))
    return {
      target: new THREE.Vector3(focus.x, focus.room.y + 1.15, focus.z).add(right),
      az,
      el: 6 * DEG,
      dist,
      azRange: 30 * DEG,
      elMin: 0,
      elMax: 25 * DEG,
    }
  }
  const top = layout.roofY + 5.4
  return {
    target: new THREE.Vector3(0, top / 2 - 1.2, 1.5),
    az: 0,
    el: 12 * DEG,
    dist: fit(HALF_W * 2 + 10, top + 9, aspect),
    azRange: 35 * DEG,
    elMin: 5 * DEG,
    elMax: 30 * DEG,
  }
}

export function seatFocus(room: RoomLayout, seat: Pick<Seat, 'x' | 'z' | 'rot'>): Focus {
  return { kind: 'agent', room, x: seat.x, z: seat.z, rot: seat.rot }
}

export function CameraRig({ focus, layout }: { focus: Focus; layout: OfficeLayout }) {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const view = useMemo(() => viewFor(focus, layout, aspect), [focus, layout, aspect])
  const user = useRef({ az: 0, el: 0, zoom: 1 })
  const cur = useRef<{ target: THREE.Vector3; az: number; el: number; dist: number } | null>(null)
  const viewRef = useRef(view)
  viewRef.current = view

  // Cada vista nueva empieza sin el giro que hubiera hecho el usuario; sin animaciones, corte directo.
  useEffect(() => {
    user.current = { az: 0, el: 0, zoom: 1 }
    if (reduced || !cur.current) cur.current = { target: view.target.clone(), az: view.az, el: view.el, dist: view.dist }
  }, [view, reduced])

  useEffect(() => {
    const el = gl.domElement
    let last: { x: number; y: number } | null = null
    const down = (e: PointerEvent) => (last = { x: e.clientX, y: e.clientY })
    const move = (e: PointerEvent) => {
      if (!last) return
      const v = viewRef.current
      const u = user.current
      u.az = THREE.MathUtils.clamp(u.az - (e.clientX - last.x) * 0.005, -v.azRange, v.azRange)
      u.el = THREE.MathUtils.clamp(u.el + (e.clientY - last.y) * 0.004, v.elMin - v.el, v.elMax - v.el)
      last = { x: e.clientX, y: e.clientY }
    }
    const up = () => (last = null)
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      user.current.zoom = THREE.MathUtils.clamp(user.current.zoom * (1 + e.deltaY * 0.001), 0.6, 1.3)
    }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    el.addEventListener('wheel', wheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      el.removeEventListener('wheel', wheel)
    }
  }, [gl])

  useFrame((_, dt) => {
    const c = cur.current
    if (!c) return
    const v = viewRef.current
    const u = user.current
    const k = reduced ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * 5)
    c.target.lerp(v.target, k)
    c.az += (v.az + u.az - c.az) * k
    c.el += (v.el + u.el - c.el) * k
    c.dist += (v.dist * u.zoom - c.dist) * k
    camera.position.set(
      c.target.x + c.dist * Math.sin(c.az) * Math.cos(c.el),
      c.target.y + c.dist * Math.sin(c.el),
      c.target.z + c.dist * Math.cos(c.az) * Math.cos(c.el),
    )
    camera.lookAt(c.target)
  })

  return null
}
