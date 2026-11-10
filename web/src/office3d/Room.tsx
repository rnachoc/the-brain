// Una sala por departamento: suelo, alfombra del color del proyecto, puestos, pantalla de pared, plantas y lámpara.
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { agentStatus, useStore } from '../store'
import { Box, BLOB, canvasTexture, CONE, CYL, FONT, glass, mat, SPHERE } from './kit'
import { CORE_W, ROOM_D, ROOM_H, ROOM_W, type RoomLayout, type Seat } from './layout'

export interface ScreenContent {
  title: string
  subtitle: string
  lines: { label: string; value?: string; tone?: 'ok' | 'warn' | 'error' }[]
}

/** Color del proyecto apagado hacia el tono de la madera para que no chille. */
const tint = (c: string) => '#' + new THREE.Color(c).lerp(new THREE.Color('#c6a47c'), 0.45).getHexString()

const TONE = { ok: '#34d399', warn: '#f5b800', error: '#f87171' }

/** Pantalla de pared con el nombre del departamento y sus datos. */
export function WallScreen({ content, w, h, position }: { content: ScreenContent; w: number; h: number; position: [number, number, number] }) {
  const key = JSON.stringify(content)
  const tex = useMemo(
    () =>
      canvasTexture(768, Math.round((768 * h) / w), (ctx) => {
        const W = ctx.canvas.width
        const H = ctx.canvas.height
        ctx.fillStyle = '#0d1220'
        ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = '#f5b800'
        ctx.fillRect(28, 30, 6, 44)
        ctx.fillStyle = '#ffffff'
        ctx.font = `600 38px ${FONT}`
        ctx.fillText(content.title.slice(0, 30), 48, 66)
        ctx.fillStyle = '#94a3b8'
        ctx.font = `400 22px ${FONT}`
        ctx.fillText(content.subtitle.slice(0, 54), 48, 102)
        content.lines.slice(0, 6).forEach((l, i) => {
          const y = 150 + i * 44
          if (y > H - 20) return
          ctx.fillStyle = 'rgba(255,255,255,0.05)'
          ctx.fillRect(28, y - 30, W - 56, 38)
          ctx.fillStyle = l.tone ? TONE[l.tone] : '#64748b'
          ctx.fillRect(40, y - 16, 10, 10)
          ctx.fillStyle = '#e2e8f0'
          ctx.font = `400 22px ${FONT}`
          ctx.fillText(l.label.slice(0, 40), 62, y - 4)
          if (l.value) {
            ctx.font = `600 22px ${FONT}`
            ctx.textAlign = 'right'
            ctx.fillText(l.value.slice(0, 18), W - 44, y - 4)
            ctx.textAlign = 'left'
          }
        })
      }),
    [key, w, h],
  )
  useEffect(() => () => tex.dispose(), [tex])
  return (
    <group position={position}>
      <Box s={[w + 0.14, h + 0.14, 0.06]} p={[0, 0, -0.02]} c="#1b1f27" />
      <mesh position={[0, 0, 0.012]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  )
}

export function Plant({ p, s = 1 }: { p: [number, number, number]; s?: number }) {
  return (
    <group position={p} scale={s}>
      <mesh geometry={CYL} material={mat('#e8e2d6')} scale={[0.36, 0.42, 0.36]} position={[0, 0.21, 0]} castShadow />
      <mesh geometry={CONE} material={mat('#5e8c4a', 0, true)} scale={[0.5, 1.1, 0.5]} position={[0, 0.95, 0]} castShadow />
      <mesh geometry={BLOB} material={mat('#6f9e52', 0, true)} scale={[0.6, 0.5, 0.6]} position={[0.05, 0.62, 0]} castShadow />
    </group>
  )
}

function Lamp({ x, y }: { x: number; y: number }) {
  return (
    <group position={[x, y + ROOM_H, 1.2]}>
      <Box s={[0.02, 0.9, 0.02]} p={[0, -0.45, 0]} c="#2b2b2b" shadow={false} />
      <mesh geometry={CONE} material={mat('#c9a24a')} scale={[0.7, 0.45, 0.7]} position={[0, -1.05, 0]} />
      <mesh geometry={SPHERE} material={mat('#fff3c4', 1.2)} scale={0.2} position={[0, -1.25, 0]} />
    </group>
  )
}

// Una sola textura de "código" compartida por todos los monitores encendidos.
const code = canvasTexture(128, 72, () => undefined)
const CODE_MAT = new THREE.MeshBasicMaterial({ map: code, toneMapped: false })
const OFF_MAT = new THREE.MeshBasicMaterial({ color: '#1e293b' })
const CODE_COLORS = ['#7dd3fc', '#a5b4fc', '#5eead4', '#fcd34d', '#e2e8f0']
let codeRow = 0

/** Hace avanzar las líneas de los monitores encendidos. Va una vez dentro del Canvas. */
export function ScreenTicker() {
  const acc = useRef(0)
  useFrame((_, dt) => {
    acc.current += dt
    if (acc.current < 0.18) return
    acc.current = 0
    const ctx = (code.image as HTMLCanvasElement).getContext('2d')!
    ctx.drawImage(ctx.canvas, 0, -8)
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 64, 128, 8)
    codeRow++
    const indent = (codeRow * 7) % 4
    ctx.fillStyle = CODE_COLORS[codeRow % CODE_COLORS.length]
    ctx.fillRect(6 + indent * 8, 66, 20 + ((codeRow * 37) % 70), 4)
    code.needsUpdate = true
  })
  return null
}

/** Mesa con monitor y silla. El empleado se sienta en el origen mirando a +z. */
export function Desk({ seat, y }: { seat: Seat; y: number }) {
  const screenOn = useStore((s) => agentStatus(s, seat.projectId) === 'running')
  return (
    <group position={[seat.x, y, seat.z]} rotation={[0, seat.rot, 0]}>
      {/* mesa */}
      <Box s={[1.5, 0.06, 0.72]} p={[0, 0.74, 0.62]} c="#5a4636" />
      <Box s={[0.06, 0.72, 0.62]} p={[-0.68, 0.37, 0.62]} c="#2d2d30" />
      <Box s={[0.06, 0.72, 0.62]} p={[0.68, 0.37, 0.62]} c="#2d2d30" />
      {/* monitor a un lado para no tapar la cara */}
      <group position={[-0.45, 0.77, 0.72]} rotation={[0, 2.6, 0]}>
        <Box s={[0.05, 0.22, 0.05]} p={[0, 0.11, 0]} c="#222" />
        <Box s={[0.66, 0.4, 0.04]} p={[0, 0.42, 0]} c="#15161a" />
        <mesh position={[0, 0.42, 0.022]} material={screenOn ? CODE_MAT : OFF_MAT}>
          <planeGeometry args={[0.6, 0.34]} />
        </mesh>
      </group>
      <Box s={[0.42, 0.02, 0.14]} p={[0.1, 0.78, 0.46]} c="#d4d4d8" shadow={false} />
      {/* silla */}
      <Box s={[0.5, 0.08, 0.5]} p={[0, 0.46, -0.05]} c="#26272b" />
      <Box s={[0.5, 0.55, 0.07]} p={[0, 0.78, -0.3]} c="#26272b" />
      <Box s={[0.06, 0.42, 0.06]} p={[0, 0.21, -0.05]} c="#3a3a3f" />
    </group>
  )
}

function Lounge({ room }: { room: RoomLayout }) {
  const cx = (room.x0 + room.x1) / 2
  const y = room.y
  return (
    <group>
      <Box s={[4.6, 0.02, 3]} p={[cx, y + 0.02, 0.3]} c="#b5654a" shadow={false} />
      <Box s={[3.2, 0.42, 0.9]} p={[cx, y + 0.21, -1]} c="#d9824f" />
      <Box s={[3.2, 0.5, 0.25]} p={[cx, y + 0.6, -1.36]} c="#d9824f" />
      <Box s={[0.9, 0.42, 2]} p={[cx - 2.1, y + 0.21, 0.3]} c="#d9824f" />
      <Box s={[1.4, 0.36, 0.8]} p={[cx + 0.2, y + 0.18, 0.5]} c="#e7e3da" />
      <Plant p={[cx + 2.6, y, -1.5]} />
    </group>
  )
}

export function Room({ room, screen, onPick }: { room: RoomLayout; screen: ScreenContent; onPick?: (e: ThreeEvent<MouseEvent>) => void }) {
  const w = room.x1 - room.x0
  const cx = (room.x0 + room.x1) / 2
  const y = room.y
  const back = -ROOM_D / 2
  const mullions = Math.round(w / 1.6)
  // La escalera sube por el fondo del núcleo: la pantalla no puede quedar detrás de ella.
  // En una planta entera va en el ala izquierda; en el atrio, pequeña y por encima del arranque del tramo.
  const full = room.side === 'full'
  const atrium = room.side === 'atrium'
  const sx = full ? -(CORE_W / 2 + ROOM_W / 2) : atrium ? cx - 1.3 : cx
  const sw = full ? ROOM_W : w
  const screenW = atrium ? 1.7 : Math.min(3.6, sw - 1.6)
  const pad = atrium ? 0.3 : 0.6
  const screenH = atrium ? 0.95 : 1.6
  const screenY = atrium ? 2.55 : 1.8

  return (
    <group onClick={onPick}>
      {/* suelo */}
      <Box s={[w, 0.04, ROOM_D]} p={[cx, y + 0.02, 0]} c={room.lounge ? '#d8cfc0' : '#c6a47c'} shadow={false} />
      {!room.lounge && !atrium &&
        (full ? (
          [-1, 1].map((sd) => (
            <Box key={sd} s={[ROOM_W - 1.4, 0.015, ROOM_D - 2]} p={[sd * (CORE_W / 2 + ROOM_W / 2), y + 0.045, 0.1]} c={tint(room.color)} shadow={false} />
          ))
        ) : (
          <Box s={[w - 1.6, 0.015, ROOM_D - 2]} p={[cx, y + 0.045, 0.1]} c={tint(room.color)} shadow={false} />
        ))}
      {/* pared trasera de cristal con montantes */}
      <mesh position={[cx, y + ROOM_H / 2, back + 0.05]} scale={[w, ROOM_H, 1]} material={glass}>
        <planeGeometry />
      </mesh>
      {Array.from({ length: mullions + 1 }, (_, i) => (
        <Box key={i} s={[0.07, ROOM_H, 0.07]} p={[room.x0 + (i * w) / mullions, y + ROOM_H / 2, back + 0.05]} c="#2b2d31" shadow={false} />
      ))}
      <Box s={[w, 0.07, 0.07]} p={[cx, y + 1.0, back + 0.05]} c="#2b2d31" shadow={false} />
      {/* panel oscuro con la pantalla */}
      <Box s={[screenW + pad, screenH + pad, 0.08]} p={[sx, y + screenY - 0.05, back + 0.12]} c="#24262b" />
      <WallScreen content={screen} w={screenW} h={screenH} position={[sx, y + screenY, back + 0.22]} />
      {room.lounge ? (
        <Lounge room={room} />
      ) : (
        room.seats.map((s) => <Desk key={s.projectId} seat={s} y={y} />)
      )}
      <Plant p={[room.x0 + 0.6, y, back + 0.6]} />
      <Plant p={[room.x1 - 0.6, y, back + 0.6]} s={0.85} />
      {room.side !== 'atrium' && <Lamp x={cx + w * 0.3} y={y} />}
    </group>
  )
}
