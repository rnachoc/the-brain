// Estructura y exterior: losas, pilares, escalera, cubierta ajardinada, torre, piscina, terreno y colinas.
import type { ThreeEvent } from '@react-three/fiber'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { BLOB, Box, canvasTexture, CONE, CYL6, glass, mat, seeded, SPHERE } from './kit'
import { CORE_W, FLIGHT_D, flightDir, flightZ, FLOOR_H, HALF_W, POOL, ROOM_D, ROOM_H, SLAB, STAIR_HOLE, STAIR_X, TOWER, type OfficeLayout } from './layout'
import { Plant, WallScreen, type ScreenContent } from './Room'

const DEPTH = ROOM_D + 0.5

function Tree({ p, s = 1, kind = 0 }: { p: [number, number, number]; s?: number; kind?: number }) {
  const ref = useRef<THREE.Group>(null)
  const phase = useMemo(() => p[0] * 0.7 + p[2], [p])
  // La copa se mece un poco con el viento.
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = Math.sin(clock.elapsedTime * 0.8 + phase) * 0.025
  })
  return (
    <group ref={ref} position={p} scale={s}>
      <mesh geometry={CYL6} material={mat('#6b4a32', 0, true)} scale={[0.22, 1.6, 0.22]} position={[0, 0.8, 0]} castShadow />
      {kind === 0 ? (
        // copa plana tipo acacia
        <>
          <mesh geometry={BLOB} material={mat('#7a9a3c', 0, true)} scale={[2.4, 0.7, 2.1]} position={[0, 1.8, 0]} castShadow />
          <mesh geometry={BLOB} material={mat('#8bab45', 0, true)} scale={[1.5, 0.55, 1.4]} position={[0.3, 2.15, 0.1]} castShadow />
        </>
      ) : (
        <mesh geometry={CONE} material={mat('#5d8a45', 0, true)} scale={[1.4, 2.6, 1.4]} position={[0, 2.3, 0]} castShadow />
      )}
    </group>
  )
}

function Lounger({ p, rot }: { p: [number, number, number]; rot: number }) {
  return (
    <group position={p} rotation={[0, rot, 0]}>
      <Box s={[0.6, 0.12, 1.7]} p={[0, 0.3, 0]} c="#f4f1ea" />
      <Box s={[0.6, 0.1, 0.6]} p={[0, 0.5, -0.75]} c="#f4f1ea" rotation={[0.7, 0, 0]} />
      <Box s={[0.5, 0.24, 0.08]} p={[0, 0.12, 0.7]} c="#9ca3af" />
      <Box s={[0.5, 0.24, 0.08]} p={[0, 0.12, -0.7]} c="#9ca3af" />
    </group>
  )
}

/** Silueta de colinas en una capa. */
function Hills({ z, color, amp, seed, base }: { z: number; color: string; amp: number; seed: string; base: number }) {
  const geo = useMemo(() => {
    const r = seeded(seed)
    const shape = new THREE.Shape()
    const W = 260
    shape.moveTo(-W / 2, -2)
    for (let x = -W / 2; x <= W / 2; x += 9 + r() * 10) shape.lineTo(x, amp * (0.35 + r() * 0.65))
    shape.lineTo(W / 2, -2)
    shape.closePath()
    return new THREE.ShapeGeometry(shape)
  }, [seed, amp])
  return (
    <mesh geometry={geo} position={[0, base, z]}>
      <meshBasicMaterial color={color} />
    </mesh>
  )
}

/** Escalera en U: cada tramo sube una planta por su carril, alternando sentido. */
function Stairs({ floors }: { floors: number }) {
  const steps = 11
  const run = (STAIR_X * 2) / steps
  const rise = FLOOR_H / steps
  return (
    <group>
      {Array.from({ length: floors }, (_, f) =>
        Array.from({ length: steps }, (_, i) => (
          <Box
            key={`${f}-${i}`}
            s={[run + 0.02, 0.12, FLIGHT_D]}
            p={[flightDir(f) * (-STAIR_X + run * (i + 0.5)), f * FLOOR_H + SLAB + rise * (i + 1) - 0.06, flightZ(f)]}
            c="#3a3c40"
          />
        )),
      )}
      {/* barandilla de cristal por delante de los tramos del carril delantero */}
      {Array.from({ length: floors }, (_, f) =>
        f % 2 ? (
          <mesh key={f} material={glass} position={[0, f * FLOOR_H + SLAB + FLOOR_H / 2 + 0.45, STAIR_HOLE.z1]} rotation={[0, 0, flightDir(f) * Math.atan2(FLOOR_H, STAIR_X * 2)]}>
            <planeGeometry args={[Math.hypot(FLOOR_H, STAIR_X * 2), 0.9]} />
          </mesh>
        ) : null,
      )}
    </group>
  )
}

/** Forjado de una planta con el hueco de la escalera (la planta baja y la cubierta van enteras). */
function Slab({ y, hole }: { y: number; hole: boolean }) {
  const W = HALF_W * 2 + 0.4
  const z0 = -DEPTH / 2
  const z1 = DEPTH / 2
  if (!hole) return <Box s={[W, SLAB, DEPTH]} p={[0, y, 0]} c="#ddd6ca" />
  const h = STAIR_HOLE
  const side = (W / 2 + h.x0) // ancho de cada lado del hueco
  return (
    <group>
      <Box s={[W, SLAB, h.z0 - z0]} p={[0, y, (z0 + h.z0) / 2]} c="#ddd6ca" />
      <Box s={[W, SLAB, z1 - h.z1]} p={[0, y, (h.z1 + z1) / 2]} c="#ddd6ca" />
      <Box s={[side, SLAB, h.z1 - h.z0]} p={[-W / 2 + side / 2, y, (h.z0 + h.z1) / 2]} c="#ddd6ca" />
      <Box s={[side, SLAB, h.z1 - h.z0]} p={[W / 2 - side / 2, y, (h.z0 + h.z1) / 2]} c="#ddd6ca" />
    </group>
  )
}

/** Agua con reflejos que se desplazan despacio. */
function Water() {
  const tex = useMemo(() => {
    const r = seeded('water')
    const t = canvasTexture(256, 128, (ctx) => {
      ctx.fillStyle = '#2fb6ec'
      ctx.fillRect(0, 0, 256, 128)
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.lineWidth = 2
      for (let i = 0; i < 26; i++) {
        const x = r() * 256
        const y = r() * 128
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.bezierCurveTo(x + 10, y - 6, x + 22, y + 6, x + 34, y)
        ctx.stroke()
      }
    })
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(5, 1)
    return t
  }, [])
  useFrame((_, dt) => {
    tex.offset.x += dt * 0.015
    tex.offset.y += dt * 0.006
  })
  return (
    <mesh position={[POOL.cx, POOL.waterY, POOL.cz]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[16.2, 2.7]} />
      <meshLambertMaterial map={tex} emissive="#0ea5e9" emissiveIntensity={0.25} />
    </mesh>
  )
}

function Parasol({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      <Box s={[0.06, 2.3, 0.06]} p={[0, 1.15, 0]} c="#e7e3da" />
      <mesh geometry={CONE} material={mat('#e9824f', 0, true)} scale={[2.6, 0.55, 2.6]} position={[0, 2.35, 0]} castShadow />
    </group>
  )
}

/** Nubes bajas que cruzan el cielo muy despacio. */
function Clouds() {
  const ref = useRef<THREE.Group>(null)
  const clouds = useMemo(() => {
    const r = seeded('clouds')
    return Array.from({ length: 7 }, () => ({ x: -90 + r() * 180, y: 24 + r() * 14, z: -45 - r() * 30, s: 3 + r() * 4 }))
  }, [])
  useFrame((_, dt) => {
    if (!ref.current) return
    for (const c of ref.current.children) {
      c.position.x += dt * 0.6
      if (c.position.x > 100) c.position.x = -100
    }
  })
  return (
    <group ref={ref}>
      {clouds.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} scale={c.s}>
          <mesh geometry={BLOB} material={mat('#ffffff', 0.35, true)} scale={[2.2, 0.8, 1]} />
          <mesh geometry={BLOB} material={mat('#ffffff', 0.35, true)} scale={[1.3, 0.9, 1]} position={[0.7, 0.35, 0]} />
          <mesh geometry={BLOB} material={mat('#ffffff', 0.35, true)} scale={[1.1, 0.7, 1]} position={[-0.8, 0.2, 0]} />
        </group>
      ))}
    </group>
  )
}

function Tower({ layout, notes, onPick }: { layout: OfficeLayout; notes: number; onPick: (e: ThreeEvent<MouseEvent>) => void }) {
  const y = layout.roofY
  const back = -TOWER.d / 2 - 0.4
  const screen: ScreenContent = useMemo(
    () => ({ title: 'The Brain', subtitle: 'Memoria compartida de la oficina', lines: [{ label: 'Notas', value: String(notes), tone: 'ok' }] }),
    [notes],
  )
  return (
    <group onClick={onPick}>
      <Box s={[TOWER.w + 0.4, SLAB, TOWER.d + 0.4]} p={[0, y + TOWER.h + SLAB / 2, -0.4]} c="#d6d0c4" />
      <Box s={[TOWER.w, 0.04, TOWER.d]} p={[0, y + 0.02, -0.4]} c="#1f2440" shadow={false} />
      <Box s={[TOWER.w, TOWER.h, 0.1]} p={[0, y + TOWER.h / 2, back]} c="#1b1f33" />
      {[-1, 1].map((sx) => (
        <Box key={sx} s={[0.18, TOWER.h, 0.18]} p={[sx * (TOWER.w / 2), y + TOWER.h / 2, -0.4 + TOWER.d / 2]} c="#2b2d31" />
      ))}
      <WallScreen content={screen} w={3.4} h={1.5} position={[0, y + 1.6, back + 0.1]} />
      {/* cúpula */}
      <mesh position={[0, y + TOWER.h + SLAB, -0.4]} scale={[3.4, 3.4, 3.4]} castShadow material={mat('#b4683a', 0, true)}>
        <sphereGeometry args={[0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh geometry={SPHERE} material={mat('#c4b5fd', 1.4)} scale={0.5} position={[0, y + 1.0, -0.4]} />
      <Plant p={[TOWER.w / 2 - 0.5, y, -0.4 - TOWER.d / 2 + 0.6]} s={0.8} />
    </group>
  )
}

export function Building({ layout, notes, onTower }: { layout: OfficeLayout; notes: number; onTower: (e: ThreeEvent<MouseEvent>) => void }) {
  const { floors, roofY } = layout
  const pillarsX = [-HALF_W, -CORE_W / 2, CORE_W / 2, HALF_W]
  const trees = useMemo(() => {
    const r = seeded('trees')
    const spots: [number, number][] = [
      [-15.5, -2],
      [-14, 3.5],
      [-16.5, 6.5],
      [15.5, -3],
      [16.5, 2],
      [14.2, 7.6],
      [-8, -6.5],
      [7, -6.8],
      [-1, -7.4],
    ]
    return spots.map(([x, z], i) => ({ x, z, s: 0.75 + r() * 0.45, kind: i % 3 === 2 ? 1 : 0 }))
  }, [])

  return (
    <group>
      {/* terreno recortado */}
      <Box s={[36, 0.3, 20]} p={[0, -0.15, 0.5]} c="#8aa44a" />
      <Box s={[36, 1.4, 20]} p={[0, -1.0, 0.5]} c="#8b6a4b" />
      <Box s={[36.2, 0.5, 20.2]} p={[0, -1.6, 0.5]} c="#6f7378" />
      {/* llanura y colinas del fondo */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.85, -40]}>
        <planeGeometry args={[400, 120]} />
        <meshBasicMaterial color="#c9c690" />
      </mesh>
      <Clouds />
      <Hills z={-95} base={-2} amp={30} color="#c7d3da" seed="h3" />
      <Hills z={-75} base={-2} amp={20} color="#a9bcbf" seed="h2" />
      <Hills z={-55} base={-2} amp={11} color="#93a98c" seed="h1" />

      {/* piscina */}
      <Box s={[17, 0.3, 3.4]} p={[4.2, 0.0, 6.3]} c="#f1eee6" />
      <Water />
      {POOL.loungers.map((l) => (
        <Lounger key={l.x} p={[l.x, 0, l.z]} rot={l.rot} />
      ))}
      <Parasol p={[-6.25, 0, 7.9]} />
      {trees.map((t, i) => (
        <Tree key={i} p={[t.x, 0, t.z]} s={t.s} kind={t.kind} />
      ))}

      {/* losas */}
      {Array.from({ length: floors + 1 }, (_, f) => (
        <group key={f}>
          <Slab y={f * FLOOR_H + SLAB / 2} hole={f > 0 && f < floors} />
          <Box s={[HALF_W * 2 + 0.42, 0.08, 0.06]} p={[0, f * FLOOR_H + SLAB - 0.04, DEPTH / 2]} c="#3a3c40" shadow={false} />
        </group>
      ))}
      {/* pilares y paredes de los extremos */}
      {Array.from({ length: floors }, (_, f) => (
        <group key={f}>
          {pillarsX.map((x) => (
            <Box key={x} s={[0.22, ROOM_H, 0.22]} p={[x, f * FLOOR_H + SLAB + ROOM_H / 2, ROOM_D / 2 - 0.1]} c="#34363b" />
          ))}
          {[-1, 1].map((sx) => (
            <Box key={sx} s={[0.18, ROOM_H, ROOM_D]} p={[sx * (HALF_W + 0.05), f * FLOOR_H + SLAB + ROOM_H / 2, 0]} c="#3d3f44" />
          ))}
        </group>
      ))}
      <Stairs floors={floors} />

      {/* cubierta ajardinada */}
      <Box s={[HALF_W * 2 - 1, 0.25, DEPTH - 1]} p={[0, roofY + 0.12, 0]} c="#7f9b46" />
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <Tree p={[sx * (HALF_W - 2.2), roofY + 0.25, 0.6]} s={0.45} kind={0} />
          <Plant p={[sx * (HALF_W - 5), roofY + 0.25, -1.6]} s={0.9} />
          <Plant p={[sx * (HALF_W - 6.2), roofY + 0.25, 1.4]} s={0.7} />
        </group>
      ))}
      <mesh position={[0, roofY + 0.55, DEPTH / 2 - 0.05]} scale={[HALF_W * 2 + 0.4, 0.6, 1]} material={glass}>
        <planeGeometry />
      </mesh>
      <Tower layout={layout} notes={notes} onPick={onTower} />
    </group>
  )
}

