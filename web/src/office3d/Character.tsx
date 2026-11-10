// Personaje de bloques y sus animaciones. Cada empleado tiene un pequeño "cerebro" que decide qué hace:
// libre → pasea, se estira, mira el móvil, toma café; trabajando → teclea y de vez en cuando se echa
// hacia atrás o se rasca la cabeza; esperando → saluda y da saltitos para que lo veas.
import { Html } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useFrame } from '@react-three/fiber'
import { forwardRef, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import * as THREE from 'three'
import type { AgentStatus } from '../types'
import { Bubble } from './Bubble'
import { BOX, CYL, mat } from './kit'
import { POOL, type RoomLayout } from './layout'
import { faceMaterial, type Look } from './look'
import { approachOf, claimActivity, release, routeOut, type Activity } from './outings'

const RING = new THREE.RingGeometry(0.42, 0.52, 28)
const RING_MAT = new THREE.MeshBasicMaterial({ color: '#F5B800', transparent: true, opacity: 0.85, toneMapped: false, depthWrite: false })

type Action = 'idle' | 'type' | 'wave' | 'hold'
export type Gesture = 'none' | 'stretch' | 'phone' | 'sip' | 'scratch' | 'lean' | 'point' | 'nod'

/** Estado que el controlador del empleado escribe y el cuerpo lee en cada frame (sin renders). */
export interface Anim {
  /** 0 = quieto, 1 = andando. */
  walk: number
  sit: boolean
  gesture: Gesture
  /** De pie, tumbado boca arriba (tumbona) o nadando boca abajo. */
  pose: 'stand' | 'lie' | 'swim'
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]

function Part({ s, p, m }: { s: [number, number, number]; p: [number, number, number]; m: THREE.Material | THREE.Material[] }) {
  return <mesh geometry={BOX} material={m} scale={s} position={p} castShadow />
}

function Hair({ look }: { look: Look }) {
  const m = mat(look.hair)
  switch (look.hairStyle) {
    case 0: // corto
      return <Part s={[0.43, 0.1, 0.43]} p={[0, 0.43, -0.01]} m={m} />
    case 1: // con flequillo
      return (
        <>
          <Part s={[0.43, 0.12, 0.43]} p={[0, 0.44, 0]} m={m} />
          <Part s={[0.43, 0.08, 0.06]} p={[0, 0.35, 0.2]} m={m} />
        </>
      )
    case 2: // media melena
      return (
        <>
          <Part s={[0.44, 0.12, 0.44]} p={[0, 0.44, 0]} m={m} />
          <Part s={[0.45, 0.36, 0.12]} p={[0, 0.24, -0.17]} m={m} />
          <Part s={[0.06, 0.3, 0.38]} p={[-0.21, 0.26, -0.02]} m={m} />
          <Part s={[0.06, 0.3, 0.38]} p={[0.21, 0.26, -0.02]} m={m} />
        </>
      )
    default: // tupé
      return <Part s={[0.38, 0.16, 0.36]} p={[0, 0.47, 0.03]} m={m} />
  }
}

const Leg = forwardRef<THREE.Group, { x: number; pants: THREE.Material; shoes: THREE.Material }>(({ x, pants, shoes }, ref) => (
  <group ref={ref} position={[x, 0.76, 0]}>
    <Part s={[0.21, 0.7, 0.24]} p={[0, -0.35, 0]} m={pants} />
    <Part s={[0.22, 0.08, 0.3]} p={[0, -0.72, 0.03]} m={shoes} />
  </group>
))

/** Brazo con pivote en el hombro (relativo a la cadera). Los objetos de la mano se muestran por ref. */
const Arm = forwardRef<THREE.Group, { x: number; shirt: THREE.Material; skin: THREE.Material; children?: React.ReactNode }>(({ x, shirt, skin, children }, ref) => (
  <group ref={ref} position={[x, 0.56, 0]}>
    <Part s={[0.16, 0.5, 0.18]} p={[0, -0.25, 0]} m={shirt} />
    <Part s={[0.14, 0.12, 0.15]} p={[0, -0.56, 0]} m={skin} />
    {children}
  </group>
))

const STILL: Anim = { walk: 0, sit: false, gesture: 'none', pose: 'stand' }

/** Cuerpo de bloques con origen en los pies, mirando a +z. Unos 1,7 m de alto. */
export function BlockPerson({ look, sitting, action, anim }: { look: Look; sitting: boolean; action: Action; anim?: MutableRefObject<Anim> }) {
  const root = useRef<THREE.Group>(null)
  const upper = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const legL = useRef<THREE.Group>(null)
  const legR = useRef<THREE.Group>(null)
  const phone = useRef<THREE.Mesh>(null)
  const cup = useRef<THREE.Mesh>(null)
  const phase = useMemo(() => Math.random() * 10, [])

  const skin = mat(look.skin)
  const headMats = useMemo(() => {
    const face = faceMaterial(look)
    return [skin, skin, skin, skin, face, skin]
  }, [look, skin])

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime + phase
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 9)
    const a = anim?.current ?? { ...STILL, sit: sitting }
    const sit = a.sit
    const g = a.walk > 0.3 ? 'none' : a.gesture
    const rot = (o: THREE.Object3D | null, x: number, z = 0, y = 0) => {
      if (!o) return
      o.rotation.x += (x - o.rotation.x) * k
      o.rotation.y += (y - o.rotation.y) * k
      o.rotation.z += (z - o.rotation.z) * k
    }

    // Andar: piernas y brazos en oposición y un pequeño bote.
    const step = Math.sin(t * 8.5)
    const w = a.walk
    const lying = a.pose !== 'stand'
    if (root.current) {
      const y = lying ? 0 : sit ? -0.27 : Math.abs(step) * 0.05 * w + (action === 'wave' && !sit ? Math.max(0, Math.sin(t * 3.2)) ** 6 * 0.12 : 0)
      root.current.position.y += (y - root.current.position.y) * k
      const tilt = a.pose === 'lie' ? -Math.PI / 2 : a.pose === 'swim' ? Math.PI / 2 : 0
      root.current.rotation.x += (tilt - root.current.rotation.x) * k
    }
    const kick = a.pose === 'swim' ? Math.sin(t * 10) * 0.3 : 0
    rot(legL.current, sit ? -Math.PI / 2 : lying ? kick : step * 0.65 * w)
    rot(legR.current, sit ? -Math.PI / 2 : lying ? -kick : -step * 0.65 * w)

    // Tronco: respira, se balancea al estar de pie y se echa atrás al estirarse en la silla.
    const breathe = Math.sin(t * 1.7) * 0.012
    const sway = sit ? 0 : Math.sin(t * 0.6) * 0.025 * (1 - w)
    rot(upper.current, (g === 'lean' ? -0.22 : action === 'type' && sit ? 0.08 : 0) + breathe, sway)
    if (upper.current) upper.current.scale.y = 1 + breathe * 0.6

    // Brazos.
    let L: [number, number] = [Math.sin(t * 1.3) * 0.05 - step * 0.55 * w, 0.07]
    let R: [number, number] = [-Math.sin(t * 1.3) * 0.05 + step * 0.55 * w, -0.07]
    if (action === 'type' && sit) {
      L = [-1.2 + Math.sin(t * 15) * 0.09, 0.1]
      R = [-1.2 + Math.sin(t * 15 + 1.7) * 0.09, -0.1]
      // Pausas para pensar: deja de teclear un momento.
      if (Math.sin(t * 0.7) > 0.85) L = R = [-0.9, 0.12]
    }
    if (action === 'wave' && !sit) R = [0, -(2.55 + Math.sin(t * 9) * 0.35)]
    if (action === 'hold') {
      L = [-0.95 + Math.sin(t * 0.8) * 0.05, 0.1]
      R = [-0.25, -0.06]
    }
    if (g === 'stretch') (L = [0, 2.9]), (R = [0, -2.9])
    if (g === 'phone') L = [-1.75, 0.35]
    if (g === 'sip') R = [Math.sin(t * 2) > 0 ? -2.25 : -1.5, -0.3]
    if (g === 'scratch') R = [-0.5, -2.75 + Math.sin(t * 14) * 0.08]
    if (g === 'lean') (L = [-0.4, 2.6]), (R = [-0.4, -2.6])
    if (g === 'point') R = [-1.45, -0.15]
    if (a.pose === 'lie') (L = [-0.4, 2.6]), (R = [-0.4, -2.6])
    if (a.pose === 'swim' && armL.current && armR.current) {
      // Crol: los brazos giran enteros, alternados.
      armL.current.rotation.set(-(t * 4) % (Math.PI * 2), 0, 0.1)
      armR.current.rotation.set(-(t * 4 + Math.PI) % (Math.PI * 2), 0, -0.1)
    } else {
      rot(armL.current, L[0], L[1])
      rot(armR.current, R[0], R[1])
    }
    if (phone.current) phone.current.visible = g === 'phone'
    if (cup.current) cup.current.visible = g === 'sip'

    // Cabeza: mira la pantalla al teclear, el móvil o la tablilla, alrededor cuando está libre, a ti cuando espera.
    let hy = 0
    let hx = 0
    if (action === 'type' && sit) (hy = 0.45 + Math.sin(t * 0.9) * 0.08), (hx = 0.12 + Math.sin(t * 3) * 0.03)
    else if (action === 'idle') hy = Math.sin(t * 0.45) * Math.max(0, Math.sin(t * 0.21)) * 0.8
    else if (action === 'wave') (hy = 0.3), (hx = Math.sin(t * 6) * 0.06)
    else if (action === 'hold') (hx = Math.sin(t * 0.5) > 0.3 ? 0.35 : 0), (hy = Math.sin(t * 0.3) * 0.4)
    if (g === 'phone') (hx = 0.4), (hy = 0.15)
    if (g === 'stretch' || g === 'lean') hx = -0.25
    if (g === 'nod') hx = Math.max(0, Math.sin(t * 9)) * 0.25
    if (g === 'scratch') hy = -0.2
    if (w > 0.3) (hy = 0), (hx = 0)
    if (a.pose === 'lie') (hx = -0.35), (hy = Math.sin(t * 0.3) * 0.3)
    if (a.pose === 'swim') (hx = -0.5), (hy = Math.sin(t * 4) * 0.35)
    rot(head.current, hx, Math.sin(t * 0.33) * 0.03, hy)
  })

  const shirt = mat(look.shirt)
  const pants = mat(look.pants)
  const shoes = mat(look.shoes)
  return (
    <group ref={root}>
      <Leg ref={legL} x={-0.12} pants={pants} shoes={shoes} />
      <Leg ref={legR} x={0.12} pants={pants} shoes={shoes} />
      {/* Tronco, brazos y cabeza pivotan en la cadera. */}
      <group ref={upper} position={[0, 0.76, 0]}>
        <Part s={[0.52, 0.62, 0.3]} p={[0, 0.3, 0]} m={shirt} />
        <Part s={[0.2, 0.1, 0.02]} p={[0, 0.54, 0.16]} m={mat('#f4f1ea')} />
        <Arm ref={armL} x={-0.34} shirt={shirt} skin={skin}>
          {action === 'hold' && <Part s={[0.26, 0.34, 0.03]} p={[0.08, -0.62, 0.08]} m={mat('#3b3f48')} />}
          <mesh ref={phone} geometry={BOX} material={mat('#1f2430')} scale={[0.09, 0.17, 0.02]} position={[0.02, -0.66, 0.07]} visible={false} />
        </Arm>
        <Arm ref={armR} x={0.34} shirt={shirt} skin={skin}>
          <mesh ref={cup} geometry={CYL} material={mat('#f4f1ea')} scale={[0.1, 0.13, 0.1]} position={[0, -0.66, 0.07]} visible={false} />
        </Arm>
        <group ref={head} position={[0, 0.61, 0]}>
          <Part s={[0.42, 0.42, 0.42]} p={[0, 0.21, 0]} m={headMats} />
          <Hair look={look} />
        </group>
      </group>
    </group>
  )
}

// Sitios cercanos a los que se acerca un empleado libre, en coordenadas de su puesto (lejos de la mesa).
const SPOTS: [number, number][] = [
  [1.7, 0.6],
  [1.4, -0.9],
  [1.15, 1.8],
  [2.1, 1.3],
  [0.6, -1.1],
]
const HOME_STAND = new THREE.Vector3(0.92, 0, -0.1)
const HOME_SIT = new THREE.Vector3(0, 0, -0.05)
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const WALK = 0.95
const HURRY = 2.2

type Mode = 'home' | 'wander' | 'linger' | 'out' | 'activity' | 'back'

interface Brain {
  mode: Mode
  path: THREE.Vector3[]
  i: number
  outPath: THREE.Vector3[]
  act: Activity | null
  until: number
  nextAt: number
  gestureUntil: number
  face: number
  swimDir: number
}

/**
 * Decide qué hace el empleado y lo mueve por el mundo; escribe en `anim` lo que el cuerpo debe dibujar.
 * Libre: a veces se acerca a un sitio cercano y a veces baja a la piscina (tumbona, nadar o charlar).
 * Si le llega trabajo o una decisión, vuelve a su puesto con prisa.
 */
function useBehaviour(status: AgentStatus, room: RoomLayout, seat: { x: number; z: number; rot: number }, mover: MutableRefObject<THREE.Group | null>) {
  const anim = useRef<Anim>({ walk: 0, sit: status === 'running', gesture: 'none', pose: 'stand' })
  const world = useMemo(() => {
    const at = (v: THREE.Vector3) => v.clone().applyAxisAngle(Y_AXIS, seat.rot).add(new THREE.Vector3(seat.x, room.y, seat.z))
    return { stand: at(HOME_STAND), sit: at(HOME_SIT), spots: SPOTS.map(([x, z]) => at(new THREE.Vector3(x, 0, z))) }
  }, [room, seat.x, seat.z, seat.rot])
  const st = useRef<Brain>({ mode: 'home', path: [], i: 0, outPath: [], act: null, until: 0, nextAt: 2 + Math.random() * 8, gestureUntil: 0, face: 0, swimDir: 1 })

  // Al desmontar (cambio de config o de pestaña) suelta el sitio de la piscina.
  useEffect(() => () => void (st.current.act && release(st.current.act.slot)), [])

  useFrame(({ clock }, dt) => {
    const m = mover.current
    if (!m) return
    const t = clock.elapsedTime
    const s = st.current
    const a = anim.current
    const d = Math.min(dt, 0.1)
    const home = status === 'running' ? world.sit : world.stand

    const goBack = () => {
      let back: THREE.Vector3[] = []
      if (s.mode === 'out') back = s.outPath.slice(0, s.i).reverse()
      else if (s.mode === 'activity') back = s.outPath.slice().reverse()
      if (s.act) release(s.act.slot)
      s.act = null
      s.mode = 'back'
      s.path = [...back, home.clone()]
      s.i = 0
    }
    if (status !== 'idle' && s.mode !== 'home' && s.mode !== 'back') goBack()
    if (s.mode === 'back' && s.path.length) s.path[s.path.length - 1].copy(home)

    // Destino de este frame.
    let dest = home
    let walkingMode = false
    if (s.mode === 'wander' || s.mode === 'out' || s.mode === 'back') {
      dest = s.path[s.i]
      walkingMode = true
    } else if (s.mode === 'linger') dest = s.path[s.path.length - 1]
    else if (s.mode === 'activity' && s.act) {
      if (s.act.kind === 'swim') {
        // Nada de un extremo a otro de su calle.
        m.position.x += s.swimDir * 0.75 * d
        if (m.position.x > POOL.x1 - 0.8) s.swimDir = -1
        if (m.position.x < POOL.x0 + 0.8) s.swimDir = 1
        dest = new THREE.Vector3(m.position.x, POOL.waterY - 0.08, s.act.lane)
      } else dest = s.act.pos
    }

    const dx = dest.x - m.position.x
    const dy = dest.y - m.position.y
    const dz = dest.z - m.position.z
    const flat = Math.hypot(dx, dz)
    const dist = Math.hypot(flat, dy)
    const speed = s.mode === 'back' && status !== 'idle' ? HURRY : WALK
    // Sentarse o levantarse, tumbarse o tirarse al agua son movimientos cortos sin paso de andar.
    const walking = walkingMode && dist > 0.04
    if (dist > 0.0005) {
      const stepLen = Math.min(dist, (walking ? speed : 2.5) * d)
      m.position.x += (dx / dist) * stepLen
      m.position.y += (dy / dist) * stepLen
      m.position.z += (dz / dist) * stepLen
    }
    a.walk += ((walking ? 1 : 0) - a.walk) * (1 - Math.exp(-d * 8))
    a.sit = status === 'running' && s.mode === 'home' && dist < 0.15
    a.pose = s.mode === 'activity' && s.act?.kind === 'lounge' && dist < 0.5 ? 'lie' : s.mode === 'activity' && s.act?.kind === 'swim' ? 'swim' : 'stand'

    // Avance por la ruta.
    if (walkingMode && dist < 0.04) {
      s.i++
      if (s.i >= s.path.length) {
        if (s.mode === 'wander') (s.mode = 'linger'), (s.until = t + 3 + Math.random() * 4), (s.face = (Math.random() - 0.5) * 1.2)
        else if (s.mode === 'out' && s.act) {
          s.mode = 'activity'
          s.until = t + 20 + Math.random() * 25
          s.swimDir = Math.random() < 0.5 ? 1 : -1
        } else s.mode = 'home'
      }
    }
    if (s.mode === 'linger' && t > s.until) (s.mode = 'back'), (s.path = [home.clone()]), (s.i = 0)
    if (s.mode === 'activity' && t > s.until) goBack()

    // Orientación.
    let yaw = seat.rot + (status === 'running' ? 0 : -0.35)
    if (walking && flat > 0.02) yaw = Math.atan2(dx, dz)
    else if (s.mode === 'linger') yaw = seat.rot + s.face
    else if (s.mode === 'activity' && s.act) yaw = s.act.kind === 'swim' ? (s.swimDir > 0 ? Math.PI / 2 : -Math.PI / 2) : s.act.yaw
    let diff = yaw - m.rotation.y
    diff = Math.atan2(Math.sin(diff), Math.cos(diff))
    m.rotation.y += diff * (1 - Math.exp(-d * 6))

    // Gestos y decisiones de vez en cuando.
    if (t > s.gestureUntil) a.gesture = 'none'
    if (t < s.nextAt || walking || a.pose !== 'stand') return
    const dur = 2 + Math.random() * 2
    s.gestureUntil = t + dur
    s.nextAt = t + dur + 2.5 + Math.random() * 5
    if (status === 'running') a.gesture = pick<Gesture>(['lean', 'scratch', 'sip', 'nod', 'none', 'none'])
    else if (status === 'waiting') a.gesture = pick<Gesture>(['none', 'none', 'nod'])
    else if (s.mode === 'home') {
      const r = Math.random()
      const act = r < 0.22 ? claimActivity() : null
      if (act) {
        s.act = act
        s.outPath = routeOut(room, world.stand, approachOf(act))
        s.mode = 'out'
        s.path = s.outPath
        s.i = 0
        a.gesture = 'none'
      } else if (r < 0.5) {
        s.mode = 'wander'
        s.path = [pick(world.spots).clone()]
        s.i = 0
        a.gesture = 'none'
      } else a.gesture = pick<Gesture>(['stretch', 'phone', 'phone', 'sip', 'none'])
    } else a.gesture = pick<Gesture>(['phone', 'sip', 'nod', 'stretch'])
  })

  return anim
}

export interface EmployeeProps {
  look: Look
  status: AgentStatus
  room: RoomLayout
  /** Puesto: posición en el mundo y giro de la mesa. */
  seat: { x: number; z: number; rot: number }
  selected: boolean
  /** Texto que aparece al pasar el ratón: "Nombre · lo que hace". */
  label: string
  /** Atenuado por un filtro: en gris y sin globo. */
  dim?: boolean
  onSelect: () => void
}

/** Empleado: trabaja sentado en su puesto, espera de pie junto a la mesa y, si está libre, hace su vida. */
export function Employee({ look, status, room, seat, selected, label, dim, onSelect }: EmployeeProps) {
  const shown = useMemo(() => (dim ? { ...look, skin: '#c4c6ca', hair: '#9ea1a8', shirt: '#b3b6bc', pants: '#94979e', glasses: false } : look), [dim, look])
  const [hover, setHover] = useState(false)
  const mover = useRef<THREE.Group>(null)
  const anim = useBehaviour(status, room, seat, mover)
  const sitting = status === 'running'
  const action: Action = status === 'running' ? 'type' : status === 'waiting' ? 'wave' : 'idle'
  // Posición inicial; a partir de ahí la mueve el comportamiento (no se vuelve a pasar como prop).
  const start = useMemo(
    () => (sitting ? HOME_SIT : HOME_STAND).clone().applyAxisAngle(Y_AXIS, seat.rot).add(new THREE.Vector3(seat.x, room.y, seat.z)).toArray() as [number, number, number],
    [],
  )

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHover(true)
    document.body.style.cursor = 'pointer'
  }
  const out = () => {
    setHover(false)
    document.body.style.cursor = ''
  }

  return (
    <group
      ref={mover}
      position={start}
      rotation={[0, seat.rot + (sitting ? 0 : -0.35), 0]}
      onPointerOver={over}
      onPointerOut={out}
      onClick={(e) => {
        e.stopPropagation()
        if (e.delta < 6) onSelect()
      }}
    >
      <BlockPerson look={shown} sitting={sitting} action={action} anim={anim} />
      {(hover || selected) && <mesh geometry={RING} material={RING_MAT} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} />}
      {status !== 'idle' && !dim && <Bubble kind={status === 'waiting' ? 'alert' : 'dots'} y={sitting ? 2.05 : 2.3} />}
      {hover && !selected && (
        <Html position={[0, 2.35, 0]} center zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded-full bg-[#0d1017]/85 px-2.5 py-1 text-[11px] font-medium text-white shadow-md shadow-black/30 ring-1 ring-inset ring-white/10">
            {label}
          </div>
        </Html>
      )}
    </group>
  )
}

/** Gestos del jefe de gabinete: mira la tablilla, levanta la vista y a veces señala. */
export function useChiefAnim() {
  const anim = useRef<Anim>({ walk: 0, sit: false, gesture: 'none', pose: 'stand' })
  const st = useRef({ nextAt: 3, until: 0 })
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (t > st.current.until) anim.current.gesture = 'none'
    if (t < st.current.nextAt) return
    const dur = rand(1.5, 3)
    st.current.until = t + dur
    st.current.nextAt = t + dur + rand(3, 7)
    anim.current.gesture = pick<Gesture>(['point', 'nod', 'none'])
  })
  return anim
}
