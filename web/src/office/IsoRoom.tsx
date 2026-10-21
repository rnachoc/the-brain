import { useEffect, useRef, useState } from 'react'
import { ProjectIcon } from '../components/icons'
import { agentStatus, lastAction, useStore } from '../store'
import type { AgentStatus, Project } from '../types'
import { AGENT_META, cx } from '../util'
import { box, iso, poly, ROOM_D, ROOM_W, roomOrigin, WALL_H } from './iso'

interface Props {
  project: Project
  gx: number
  gy: number
}

const W = ROOM_W
const D = ROOM_D
const H = WALL_H

/** Transición día/noche y de los movimientos de la persona. */
const DAY_TRANSITION = 'opacity 1.4s ease-in-out'
const WALK_MS = 1300

type Phase = 'sleeping' | 'getting-up' | 'to-desk' | 'working' | 'leaving' | 'to-bed'

/**
 * Secuencia de la persona: al activarse el agente se levanta, camina a la mesa y trabaja;
 * al pararse vuelve a la cama. Al montar no hay animación: aparece ya en su sitio.
 */
function usePhase(active: boolean): Phase {
  const [phase, setPhase] = useState<Phase>(active ? 'working' : 'sleeping')
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    const steps: [Phase, number][] = active
      ? [['getting-up', 450], ['to-desk', WALK_MS], ['working', 0]]
      : [['leaving', 350], ['to-bed', WALK_MS], ['sleeping', 0]]
    const timers: number[] = []
    let t = 0
    for (const [p, d] of steps) {
      timers.push(window.setTimeout(() => setPhase(p), t))
      t += d
    }
    return () => timers.forEach(clearTimeout)
  }, [active])
  return phase
}

// ---------- Personas ----------

function Head({ x, y, r = 4.8 }: { x: number; y: number; r?: number }) {
  return (
    <>
      <circle cx={x} cy={y} r={r} fill="#f1e4d4" />
      <path d={`M ${x - r} ${y - 0.5} a ${r} ${r} 0 0 1 ${r * 2} 0 z`} fill="#2a1d14" />
    </>
  )
}

function Sitting({ x, y, color, status }: { x: number; y: number; color: string; status: AgentStatus }) {
  return (
    <g className={cx(status === 'running' && 'agent-bob')}>
      <ellipse cx={x} cy={y - 7} rx={5.6} ry={7.2} fill={color} />
      <ellipse cx={x} cy={y - 7} rx={5.6} ry={7.2} fill="#000" opacity={0.18} />
      <Head x={x} y={y - 18} />
      {status === 'waiting' && (
        <g className="waiting-bounce">
          <circle cx={x + 7} cy={y - 30} r={5.5} fill="#f59e0b" />
          <text x={x + 7} y={y - 27} textAnchor="middle" fontSize={8} fontWeight={700} fill="#1c1917">
            !
          </text>
        </g>
      )}
    </g>
  )
}

function Standing({ color, walking }: { color: string; walking: boolean }) {
  return (
    <g className={cx(walking && 'walk-bob')}>
      <ellipse cx={0} cy={0} rx={7} ry={3.5} fill="#000" opacity={0.3} />
      <line x1={-2.2} y1={-1} x2={-2.2} y2={-10} stroke="#1e293b" strokeWidth={3} strokeLinecap="round" className={cx(walking && 'leg-a')} />
      <line x1={2.2} y1={-1} x2={2.2} y2={-10} stroke="#1e293b" strokeWidth={3} strokeLinecap="round" className={cx(walking && 'leg-b')} />
      <ellipse cx={0} cy={-17} rx={5.4} ry={8} fill={color} />
      <ellipse cx={0} cy={-17} rx={5.4} ry={8} fill="#000" opacity={0.18} />
      <Head x={0} y={-29} />
    </g>
  )
}

interface Spot {
  bedX: number
  bedY: number
  deskX: number
  deskY: number
}

function Resident({ spot, color, status }: { spot: Spot; color: string; status: AgentStatus }) {
  const phase = usePhase(status !== 'idle')
  const { bedX, bedY, deskX, deskY } = spot

  // Cama a lo largo de x, con el cabecero contra la pared izquierda.
  const frame = box(bedX, bedY, 0, 2.8, 1.8, 0.45)
  const mattress = box(bedX + 0.05, bedY + 0.05, 0.45, 2.7, 1.7, 0.22)
  const headboard = box(bedX - 0.15, bedY, 0, 0.18, 1.8, 1.25)
  const pillow = box(bedX + 0.15, bedY + 0.35, 0.67, 0.65, 1.1, 0.14)
  const blanketOn = box(bedX + 1.05, bedY + 0.1, 0.67, 1.75, 1.6, 0.2)
  const blanketOff = box(bedX + 2.05, bedY + 0.1, 0.67, 0.75, 1.6, 0.12)

  const desk = box(deskX, deskY, 0, 2.4, 1.3, 1.1)
  const mon = box(deskX + 0.5, deskY + 0.2, 1.1, 1.4, 0.12, 0.9)
  const chair = box(deskX + 0.75, deskY + 2.0, 0, 0.9, 0.9, 0.55)

  const [hx, hy] = iso(bedX + 0.5, bedY + 0.9, 0.95)
  const [zx, zy] = iso(bedX + 0.6, bedY + 0.6, 1.9)
  const [sx, sy] = iso(deskX + 1.2, deskY + 2.45, 0)
  const [ax, ay] = iso(deskX + 1.2, deskY + 2.45, 0.55)
  const bedSide = iso(bedX + 1.4, bedY + 2.3, 0)
  const deskSide = iso(deskX + 1.2, deskY + 3.1, 0)

  const asleep = phase === 'sleeping'
  const atDesk = phase === 'working'
  const standingAt = phase === 'getting-up' || phase === 'to-bed' ? bedSide : deskSide
  const standing = !asleep && !atDesk

  return (
    <g>
      {/* Cama */}
      <polygon points={headboard.top} fill="#6b4226" />
      <polygon points={headboard.left} fill="#5a3720" />
      <polygon points={headboard.right} fill="#4a2b18" />
      <polygon points={frame.top} fill="#7c4a2d" />
      <polygon points={frame.left} fill="#5c361f" />
      <polygon points={frame.right} fill="#4a2b18" />
      <polygon points={mattress.top} fill="#e2e8f0" />
      <polygon points={mattress.left} fill="#cbd5e1" />
      <polygon points={mattress.right} fill="#b6c2d1" />
      <polygon points={pillow.top} fill="#ffffff" />
      <polygon points={pillow.left} fill="#e5e7eb" />
      <g className={cx(asleep && 'breathe')}>
        {asleep ? (
          <>
            <polygon points={blanketOn.top} fill={color} />
            <polygon points={blanketOn.left} fill={color} />
            <polygon points={blanketOn.left} fill="#000" opacity={0.25} />
            <polygon points={blanketOn.right} fill={color} />
            <polygon points={blanketOn.right} fill="#000" opacity={0.4} />
          </>
        ) : (
          <>
            <polygon points={blanketOff.top} fill={color} />
            <polygon points={blanketOff.left} fill={color} />
            <polygon points={blanketOff.left} fill="#000" opacity={0.25} />
          </>
        )}
      </g>
      {/* La cabeza va después de la manta para que se le vea la cara sobre la almohada. */}
      {asleep && <Head x={hx} y={hy} r={4.4} />}

      {/* Mesa, ordenador y silla */}
      <polygon points={desk.top} fill="#2b3558" />
      <polygon points={desk.left} fill="#1d2542" />
      <polygon points={desk.right} fill="#161d36" />
      <polygon points={mon.top} fill="#0b0f1c" />
      <polygon points={mon.right} fill="#0b0f1c" />
      <polygon
        points={mon.left}
        fill={atDesk ? color : '#1e293b'}
        fillOpacity={atDesk ? 0.85 : 1}
        className={cx(atDesk && status === 'running' && 'screen-flicker')}
      />
      <ellipse cx={sx} cy={sy} rx={9} ry={4.5} fill="#000" opacity={0.3} />
      <polygon points={chair.top} fill="#252c47" />
      <polygon points={chair.left} fill="#191f37" />
      <polygon points={chair.right} fill="#141a2f" />
      {atDesk && <Sitting x={ax} y={ay} color={color} status={status} />}

      {/* De pie: se levanta y camina entre la cama y la mesa */}
      {standing && (
        <g
          style={{
            transform: `translate(${standingAt[0]}px, ${standingAt[1]}px)`,
            transition: `transform ${WALK_MS}ms ease-in-out`,
          }}
        >
          <Standing color={color} walking={phase === 'to-desk' || phase === 'to-bed'} />
        </g>
      )}

      {asleep && (
        <g className="zzz" fontWeight={700} fill="#c7d2fe">
          <text x={zx} y={zy} fontSize={7}>z</text>
          <text x={zx + 5} y={zy - 6} fontSize={9}>z</text>
          <text x={zx + 11} y={zy - 13} fontSize={11}>Z</text>
        </g>
      )}
    </g>
  )
}

// ---------- Ventana ----------

function Window({ x0, y0, day }: { x0: number; y0: number; day: boolean }) {
  const win = poly([[x0 + 5.2, y0, 3.4], [x0 + 8.6, y0, 3.4], [x0 + 8.6, y0, 1.6], [x0 + 5.2, y0, 1.6]])
  const at = (x: number, z: number) => iso(x0 + x, y0, z)
  const [sunX, sunY] = at(7.7, 2.85)
  const [moonX, moonY] = at(7.8, 2.9)
  const [c1x, c1y] = at(6.1, 2.3)
  return (
    <g>
      <g style={{ opacity: day ? 0 : 1, transition: DAY_TRANSITION }}>
        <polygon points={win} fill="#0a1630" />
        {[[5.9, 2.9], [6.6, 2.2], [7.1, 3.1], [6.2, 1.9], [8.2, 2.1]].map(([x, z], i) => {
          const [px, py] = at(x, z)
          return <circle key={i} cx={px} cy={py} r={0.9} fill="#e2e8f0" opacity={0.8} />
        })}
        <circle cx={moonX} cy={moonY} r={3.6} fill="#f1f5f9" />
        <circle cx={moonX + 1.6} cy={moonY - 1} r={3.2} fill="#0a1630" />
      </g>
      <g style={{ opacity: day ? 1 : 0, transition: DAY_TRANSITION }}>
        <polygon points={win} fill="#7dd3fc" />
        <circle cx={sunX} cy={sunY} r={6} fill="#fde047" opacity={0.35} />
        <circle cx={sunX} cy={sunY} r={3.8} fill="#fde047" />
        <ellipse cx={c1x} cy={c1y} rx={5} ry={2.2} fill="#fff" opacity={0.9} />
        <ellipse cx={c1x + 3.5} cy={c1y - 1.2} rx={3.5} ry={2} fill="#fff" opacity={0.9} />
      </g>
      <polygon points={win} fill="none" stroke="#475569" strokeWidth={1.2} />
    </g>
  )
}

// ---------- Sala ----------

function layout(x0: number, y0: number, n: number): Spot[] {
  const step = n === 3 ? 2.2 : 2.8
  return Array.from({ length: n }, (_, i) => ({
    bedX: x0 + 0.35,
    bedY: y0 + 0.9 + i * 2.65,
    deskX: x0 + (n === 3 ? 3.0 : 3.6) + i * step,
    deskY: y0 + 0.5,
  }))
}

export function IsoRoom({ project: p, gx, gy }: Props) {
  const status = useStore((s) => agentStatus(s, p.id))
  const selected = useStore((s) => s.selectedProjectId === p.id)
  const select = useStore((s) => s.selectProject)
  const [x0, y0] = roomOrigin(gx, gy)
  const active = status !== 'idle'

  const spots = layout(x0, y0, Math.min(Math.max(p.agents, 1), 3))

  const floor = poly([[x0, y0, 0], [x0 + W, y0, 0], [x0 + W, y0 + D, 0], [x0, y0 + D, 0]])
  const slabL = poly([[x0, y0 + D, 0], [x0 + W, y0 + D, 0], [x0 + W, y0 + D, -0.7], [x0, y0 + D, -0.7]])
  const slabR = poly([[x0 + W, y0, 0], [x0 + W, y0 + D, 0], [x0 + W, y0 + D, -0.7], [x0 + W, y0, -0.7]])
  const wallL = poly([[x0, y0, 0], [x0, y0 + D, 0], [x0, y0 + D, H], [x0, y0, H]])
  const wallR = poly([[x0, y0, 0], [x0 + W, y0, 0], [x0 + W, y0, H], [x0, y0, H]])
  const wallTop = [iso(x0, y0 + D, H), iso(x0, y0, H), iso(x0 + W, y0, H)].map((p) => p.join(',')).join(' ')
  const rug = poly([[x0 + 3.6, y0 + 4.4, 0.01], [x0 + W - 1, y0 + 4.4, 0.01], [x0 + W - 1, y0 + 8.8, 0.01], [x0 + 3.6, y0 + 8.8, 0.01]])
  const frame = poly([[x0, y0 + 8.4, 3.3], [x0, y0 + 9.6, 3.3], [x0, y0 + 9.6, 2.2], [x0, y0 + 8.4, 2.2]])
  const pot = box(x0 + 8.6, y0 + 8.5, 0, 0.9, 0.9, 0.7)
  const [lx, ly] = iso(x0 + W - 0.7, y0, H - 0.6)
  const [px, py] = iso(x0 + 9.05, y0 + 8.95, 1.35)

  const gridLines = [2, 4, 6, 8].flatMap((k) => [
    [iso(x0 + k, y0, 0), iso(x0 + k, y0 + D, 0)],
    [iso(x0, y0 + k, 0), iso(x0 + W, y0 + k, 0)],
  ])

  return (
    <g className="room cursor-pointer" onClick={() => select(selected ? null : p.id)}>
      <polygon points={slabL} fill="#0a0e1c" />
      <polygon points={slabR} fill="#0d1226" />
      <polygon points={floor} className="room-floor" fill="#0f1529" />
      <polygon points={floor} fill={p.color} fillOpacity={selected ? 0.13 : 0.05} />
      {gridLines.map(([a, b], i) => (
        <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#fff" strokeOpacity={0.035} />
      ))}
      <polygon points={rug} fill={p.color} fillOpacity={0.1} />
      {/* Borde del suelo antes de los muebles, para que no los cruce. */}
      <polygon
        points={floor}
        fill="none"
        stroke={p.color}
        strokeOpacity={selected ? 1 : 0.4}
        strokeWidth={selected ? 2.5 : 1.2}
        className={cx(active && 'room-glow')}
        filter={selected || active ? 'url(#glow)' : undefined}
      />

      <polygon points={wallL} fill="#131b35" />
      <polygon points={wallL} fill={p.color} fillOpacity={0.04} />
      <polygon points={wallR} fill="#0f162d" />
      <polyline points={wallTop} fill="none" stroke={p.color} strokeOpacity={0.7} strokeWidth={2} strokeLinejoin="round" />
      <polygon points={frame} fill="#1a2341" stroke={p.color} strokeOpacity={0.4} />

      <Window x0={x0} y0={y0} day={active} />

      {spots.map((s, i) => (
        <Resident key={i} spot={s} color={p.color} status={status} />
      ))}

      <polygon points={pot.top} fill="#7c4a2d" />
      <polygon points={pot.left} fill="#5c361f" />
      <polygon points={pot.right} fill="#4a2b18" />
      <circle cx={px} cy={py} r={6.5} fill="#15803d" />
      <circle cx={px + 3} cy={py - 4} r={4.2} fill="#22c55e" />

      {/* Luz: penumbra azul de noche, luz cálida de día */}
      <g pointerEvents="none">
        <g style={{ opacity: active ? 0 : 1, transition: DAY_TRANSITION }}>
          <polygon points={floor} fill="#050a24" opacity={0.42} />
          <polygon points={wallL} fill="#050a24" opacity={0.42} />
          <polygon points={wallR} fill="#050a24" opacity={0.42} />
        </g>
        <g style={{ opacity: active ? 1 : 0, transition: DAY_TRANSITION }}>
          <polygon points={floor} fill="#fde68a" opacity={0.06} />
          <polygon points={wallR} fill="#fde68a" opacity={0.05} />
        </g>
      </g>

      <circle cx={lx} cy={ly} r={3.4} fill={AGENT_META[status].color} className={cx(active && 'lamp-pulse')} />
    </g>
  )
}

/** Nombre de la sala y burbuja con la última acción (se pinta encima de todo). */
export function RoomOverlay({ project: p, gx, gy }: Props) {
  const status = useStore((s) => agentStatus(s, p.id))
  const last = useStore((s) => lastAction(s, p.id))
  const select = useStore((s) => s.selectProject)
  const [x0, y0] = roomOrigin(gx, gy)
  const [fx, fy] = iso(x0 + W, y0 + D, -0.7)
  // La burbuja va sobre la zona libre del suelo, delante, para no tapar la cama ni la mesa.
  const [bx, by] = iso(x0 + 6.4, y0 + 6.6, 0)
  const meta = AGENT_META[status]

  return (
    <g>
      {last && (
        <foreignObject x={bx - 95} y={by - 30} width={190} height={60} pointerEvents="none">
          <div className="flex h-full items-center justify-center">
            <div
              className={cx('bubble', status !== 'idle' && 'bubble-active')}
              style={{ ['--accent' as string]: p.color }}
            >
              {last}
            </div>
          </div>
        </foreignObject>
      )}
      <foreignObject x={fx - 130} y={fy + 6} width={260} height={46}>
        <div className="flex justify-center">
          <button
            onClick={() => select(p.id)}
            className="room-label"
            style={{ ['--accent' as string]: p.color }}
          >
            <ProjectIcon icon={p.icon} color={p.color} size="xs" />
            <span className="truncate font-pixel text-[13px] font-medium tracking-[0.02em] text-slate-50">{p.name}</span>
            <span className="h-3 w-px bg-white/10" />
            <span className="flex items-center gap-1 font-pixel text-[10px] uppercase tracking-[0.08em]" style={{ color: meta.color }}>
              <span className={cx('inline-block h-1.5 w-1.5 rounded-full', status !== 'idle' && 'animate-pulse')} style={{ background: meta.color }} />
              {meta.label}
            </span>
          </button>
        </div>
        <div className="mt-1 text-center font-pixel text-[10px] tracking-wide text-slate-500">
          {p.agents} {p.agents === 1 ? 'agente' : 'agentes'}
        </div>
      </foreignObject>
    </g>
  )
}
