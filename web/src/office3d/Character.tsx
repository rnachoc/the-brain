// Personaje de bloques y sus animaciones. Cada empleado tiene un pequeño "cerebro" que decide qué hace:
// libre → pasea, se estira, mira el móvil, toma café; trabajando → teclea y de vez en cuando se echa
// hacia atrás o se rasca la cabeza; esperando → saluda y da saltitos para que lo veas.
import type { ThreeEvent } from '@react-three/fiber'
import { useFrame } from '@react-three/fiber'
import { forwardRef, useMemo, useRef, useState, type MutableRefObject } from 'react'
import * as THREE from 'three'
import type { AgentStatus } from '../types'
import { Bubble } from './Bubble'
import { BOX, CYL, mat } from './kit'
import { faceMaterial, type Look } from './look'

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

const STILL: Anim = { walk: 0, sit: false, gesture: 'none' }

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
    if (root.current) {
      const y = sit ? -0.27 : Math.abs(step) * 0.05 * w + (action === 'wave' && !sit ? Math.max(0, Math.sin(t * 3.2)) ** 6 * 0.12 : 0)
      root.current.position.y += (y - root.current.position.y) * k
    }
    rot(legL.current, sit ? -Math.PI / 2 : step * 0.65 * w)
    rot(legR.current, sit ? -Math.PI / 2 : -step * 0.65 * w)

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
    rot(armL.current, L[0], L[1])
    rot(armR.current, R[0], R[1])
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

// Sitios a los que se acerca un empleado libre, en coordenadas de su puesto (lejos de la mesa).
const SPOTS: [number, number][] = [
  [1.7, 0.6],
  [1.4, -0.9],
  [1.15, 1.8],
  [2.1, 1.3],
  [0.6, -1.1],
]
const HOME_STAND = new THREE.Vector3(0.92, 0, -0.1)
const HOME_SIT = new THREE.Vector3(0, 0, -0.05)
const SPEED = 0.9

type Mode = 'home' | 'going' | 'away' | 'returning'

/** Decide qué hace el empleado y lo mueve; escribe en `anim` lo que el cuerpo debe dibujar. */
function useBehaviour(status: AgentStatus, mover: MutableRefObject<THREE.Group | null>) {
  const anim = useRef<Anim>({ walk: 0, sit: status === 'running', gesture: 'none' })
  const st = useRef({ mode: 'home' as Mode, target: new THREE.Vector3(), until: 0, nextAt: rand(1, 6), gestureUntil: 0, face: 0 })

  useFrame(({ clock }, dt) => {
    const m = mover.current
    if (!m) return
    const t = clock.elapsedTime
    const s = st.current
    const a = anim.current
    const d = Math.min(dt, 0.1)

    // Si le llega trabajo o una decisión mientras pasea, vuelve a su sitio.
    if (status !== 'idle' && (s.mode === 'going' || s.mode === 'away')) s.mode = 'returning'

    const home = status === 'running' ? HOME_SIT : HOME_STAND
    const dest = s.mode === 'going' || s.mode === 'away' ? s.target : home
    const dx = dest.x - m.position.x
    const dz = dest.z - m.position.z
    const dist = Math.hypot(dx, dz)
    // Sentarse o levantarse son pasos cortos: se resuelven sin animación de andar.
    const walking = dist > 0.05 && (s.mode !== 'home' || dist > 0.6)
    if (dist > 0.001) {
      const stepLen = Math.min(dist, (walking ? SPEED : 2.5) * d)
      m.position.x += (dx / dist) * stepLen
      m.position.z += (dz / dist) * stepLen
    }
    a.walk += ((walking ? 1 : 0) - a.walk) * (1 - Math.exp(-d * 8))
    a.sit = status === 'running' && dist < 0.15

    if (s.mode === 'going' && dist < 0.05) (s.mode = 'away'), (s.until = t + rand(3, 6)), (s.face = rand(-0.6, 0.6))
    if (s.mode === 'away' && t > s.until) s.mode = 'returning'
    if (s.mode === 'returning' && dist < 0.05) s.mode = 'home'

    // Hacia dónde mira: al andar, a donde va; en su sitio, a la mesa o un poco hacia ti.
    const yaw = walking ? Math.atan2(dx, dz) : s.mode === 'away' ? s.face : status === 'running' ? 0 : -0.35
    let diff = yaw - m.rotation.y
    diff = Math.atan2(Math.sin(diff), Math.cos(diff))
    m.rotation.y += diff * (1 - Math.exp(-d * 6))

    // Gestos y paseos de vez en cuando.
    if (t > s.gestureUntil) a.gesture = 'none'
    if (t < s.nextAt || walking) return
    const dur = rand(2, 4)
    s.gestureUntil = t + dur
    s.nextAt = t + dur + rand(2.5, 7)
    if (status === 'running') a.gesture = pick<Gesture>(['lean', 'scratch', 'sip', 'nod', 'none', 'none'])
    else if (status === 'waiting') a.gesture = pick<Gesture>(['none', 'none', 'nod'])
    else if (s.mode === 'home' && Math.random() < 0.4) {
      const [x, z] = pick(SPOTS)
      s.target.set(x, 0, z)
      s.mode = 'going'
      a.gesture = 'none'
    } else a.gesture = pick<Gesture>(['stretch', 'phone', 'phone', 'sip', 'none'])
  })

  return anim
}

export interface EmployeeProps {
  look: Look
  status: AgentStatus
  /** Posición del puesto en el mundo y giro de la mesa. */
  x: number
  y: number
  z: number
  rot: number
  selected: boolean
  /** Atenuado por un filtro: en gris y sin globo. */
  dim?: boolean
  onSelect: () => void
}

/** Empleado en su puesto: sentado si trabaja, de pie junto a la mesa (o paseando) si está libre o espera. */
export function Employee({ look, status, x, y, z, rot, selected, dim, onSelect }: EmployeeProps) {
  const shown = useMemo(() => (dim ? { ...look, skin: '#c4c6ca', hair: '#9ea1a8', shirt: '#b3b6bc', pants: '#94979e', glasses: false } : look), [dim, look])
  const [hover, setHover] = useState(false)
  const mover = useRef<THREE.Group>(null)
  const anim = useBehaviour(status, mover)
  const sitting = status === 'running'
  const action: Action = status === 'running' ? 'type' : status === 'waiting' ? 'wave' : 'idle'
  const start = useMemo(() => (sitting ? HOME_SIT : HOME_STAND).toArray() as [number, number, number], [])

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
    <group position={[x, y, z]} rotation={[0, rot, 0]}>
      <group
        ref={mover}
        position={start}
        rotation={[0, sitting ? 0 : -0.35, 0]}
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
      </group>
    </group>
  )
}

/** Gestos del jefe de gabinete: mira la tablilla, levanta la vista y a veces señala. */
export function useChiefAnim() {
  const anim = useRef<Anim>({ walk: 0, sit: false, gesture: 'none' })
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
