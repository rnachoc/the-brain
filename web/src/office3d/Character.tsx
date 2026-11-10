// Personaje de bloques y sus animaciones: respira y mira (idle), teclea sentado (running), saluda de pie (waiting).
import type { ThreeEvent } from '@react-three/fiber'
import { useFrame } from '@react-three/fiber'
import { forwardRef, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { AgentStatus } from '../types'
import { Bubble } from './Bubble'
import { BOX, mat } from './kit'
import { faceMaterial, type Look } from './look'

const RING = new THREE.RingGeometry(0.42, 0.52, 28)
const RING_MAT = new THREE.MeshBasicMaterial({ color: '#F5B800', transparent: true, opacity: 0.85, toneMapped: false, depthWrite: false })

type Action = 'idle' | 'type' | 'wave' | 'hold'

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

const Arm = forwardRef<THREE.Group, { x: number; shirt: THREE.Material; skin: THREE.Material; tablet?: boolean }>(({ x, shirt, skin, tablet }, ref) => (
  <group ref={ref} position={[x, 1.32, 0]}>
    <Part s={[0.16, 0.5, 0.18]} p={[0, -0.25, 0]} m={shirt} />
    <Part s={[0.14, 0.12, 0.15]} p={[0, -0.56, 0]} m={skin} />
    {tablet && <Part s={[0.26, 0.34, 0.03]} p={[0.08, -0.62, 0.08]} m={mat('#3b3f48')} />}
  </group>
))

/** Cuerpo de bloques con origen en los pies, mirando a +z. Unos 1,7 m de alto. */
export function BlockPerson({ look, sitting, action }: { look: Look; sitting: boolean; action: Action }) {
  const root = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const legL = useRef<THREE.Group>(null)
  const legR = useRef<THREE.Group>(null)
  const phase = useMemo(() => Math.random() * 10, [])

  const skin = mat(look.skin)
  const headMats = useMemo(() => {
    const face = faceMaterial(look)
    return [skin, skin, skin, skin, face, skin]
  }, [look, skin])

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime + phase
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 10)
    const to = (o: THREE.Object3D | null, x: number, z = 0) => {
      if (!o) return
      o.rotation.x += (x - o.rotation.x) * k
      o.rotation.z += (z - o.rotation.z) * k
    }
    if (root.current) {
      const y = sitting ? -0.27 : 0
      root.current.position.y += (y - root.current.position.y) * k
      root.current.scale.y = 1 + Math.sin(t * 1.6) * 0.008
    }
    const leg = sitting ? -Math.PI / 2 : 0
    to(legL.current, leg)
    to(legR.current, leg)
    if (action === 'type') {
      to(armL.current, -1.25 + Math.sin(t * 14) * 0.08)
      to(armR.current, -1.25 + Math.sin(t * 14 + 1.7) * 0.08)
    } else if (action === 'wave') {
      to(armL.current, 0, 0.06)
      to(armR.current, 0, -(2.6 + Math.sin(t * 7) * 0.3))
    } else if (action === 'hold') {
      to(armL.current, -0.9, 0.1)
      to(armR.current, -0.3, -0.06)
    } else {
      to(armL.current, Math.sin(t * 1.3) * 0.04, 0.06)
      to(armR.current, -Math.sin(t * 1.3) * 0.04, -0.06)
    }
    if (head.current) {
      // De vez en cuando mira alrededor; tecleando mira la pantalla, a su izquierda.
      const look = action === 'type' ? 0.45 : action === 'idle' ? Math.sin(t * 0.45) * Math.max(0, Math.sin(t * 0.17)) * 0.7 : 0
      head.current.rotation.y += (look - head.current.rotation.y) * k
      head.current.rotation.x += ((action === 'type' ? 0.12 : 0) - head.current.rotation.x) * k
    }
  })

  const shirt = mat(look.shirt)
  const pants = mat(look.pants)
  const shoes = mat(look.shoes)
  return (
    <group ref={root}>
      <Leg ref={legL} x={-0.12} pants={pants} shoes={shoes} />
      <Leg ref={legR} x={0.12} pants={pants} shoes={shoes} />
      <Part s={[0.52, 0.62, 0.3]} p={[0, 1.06, 0]} m={shirt} />
      <Part s={[0.2, 0.1, 0.02]} p={[0, 1.3, 0.16]} m={mat('#f4f1ea')} />
      <Arm ref={armL} x={-0.34} shirt={shirt} skin={skin} tablet={action === 'hold'} />
      <Arm ref={armR} x={0.34} shirt={shirt} skin={skin} />
      <group ref={head} position={[0, 1.37, 0]}>
        <Part s={[0.42, 0.42, 0.42]} p={[0, 0.21, 0]} m={headMats} />
        <Hair look={look} />
      </group>
    </group>
  )
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
  onSelect: () => void
}

/** Empleado en su puesto: sentado si trabaja, de pie junto a la mesa si está libre o espera. */
export function Employee({ look, status, x, y, z, rot, selected, onSelect }: EmployeeProps) {
  const [hover, setHover] = useState(false)
  const sitting = status === 'running'
  const action: Action = status === 'running' ? 'type' : status === 'waiting' ? 'wave' : 'idle'
  const pos: [number, number, number] = sitting ? [0, 0, -0.05] : [0.92, 0, -0.1]

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
        position={pos}
        rotation={[0, sitting ? 0 : -0.35, 0]}
        onPointerOver={over}
        onPointerOut={out}
        onClick={(e) => {
          e.stopPropagation()
          if (e.delta < 6) onSelect()
        }}
      >
        <BlockPerson look={look} sitting={sitting} action={action} />
        {(hover || selected) && <mesh geometry={RING} material={RING_MAT} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} />}
        {status !== 'idle' && <Bubble kind={status === 'waiting' ? 'alert' : 'dots'} y={sitting ? 2.05 : 2.3} />}
      </group>
    </group>
  )
}
