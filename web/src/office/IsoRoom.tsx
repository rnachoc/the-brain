import { agentStatus, lastAction, useStore } from '../store'
import type { Project } from '../types'
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

function Desk({ x, y, color, status }: { x: number; y: number; color: string; status: string }) {
  const desk = box(x, y, 0, 2.4, 1.3, 1.1)
  const mon = box(x + 0.5, y + 0.2, 1.1, 1.4, 0.12, 0.9)
  const chair = box(x + 0.75, y + 2.0, 0, 0.9, 0.9, 0.55)
  const [sx, sy] = iso(x + 1.2, y + 2.45, 0)
  const [ax, ay] = iso(x + 1.2, y + 2.45, 0.55)
  const active = status !== 'idle'
  return (
    <g>
      <polygon points={desk.top} fill="#2b3558" />
      <polygon points={desk.left} fill="#1d2542" />
      <polygon points={desk.right} fill="#161d36" />
      <polygon points={mon.top} fill="#0b0f1c" />
      <polygon points={mon.right} fill="#0b0f1c" />
      <polygon
        points={mon.left}
        fill={active ? color : '#1e293b'}
        fillOpacity={active ? 0.85 : 1}
        className={cx(status === 'running' && 'screen-flicker')}
      />
      <ellipse cx={sx} cy={sy} rx={9} ry={4.5} fill="#000" opacity={0.35} />
      <polygon points={chair.top} fill="#252c47" />
      <polygon points={chair.left} fill="#191f37" />
      <polygon points={chair.right} fill="#141a2f" />
      <g className={cx(status === 'running' && 'agent-bob')}>
        <ellipse cx={ax} cy={ay - 7} rx={5.6} ry={7.2} fill={color} />
        <ellipse cx={ax} cy={ay - 7} rx={5.6} ry={7.2} fill="#000" opacity={0.18} />
        <circle cx={ax} cy={ay - 18} r={4.8} fill="#f1e4d4" />
        <path
          d={`M ${ax - 4.8} ${ay - 18.5} a 4.8 4.8 0 0 1 9.6 0 z`}
          fill="#2a1d14"
        />
        {status === 'waiting' && (
          <g className="waiting-bounce">
            <circle cx={ax + 7} cy={ay - 30} r={5.5} fill="#f59e0b" />
            <text x={ax + 7} y={ay - 27} textAnchor="middle" fontSize={8} fontWeight={700} fill="#1c1917">
              !
            </text>
          </g>
        )}
      </g>
    </g>
  )
}

export function IsoRoom({ project: p, gx, gy }: Props) {
  const status = useStore((s) => agentStatus(s, p.id))
  const selected = useStore((s) => s.selectedProjectId === p.id)
  const select = useStore((s) => s.selectProject)
  const [x0, y0] = roomOrigin(gx, gy)
  const active = status !== 'idle'

  const n = Math.min(Math.max(p.agents, 1), 3)
  const span = n * 2.8 - 0.4
  const deskXs = Array.from({ length: n }, (_, i) => x0 + (W - span) / 2 + i * 2.8)

  const floor = poly([[x0, y0, 0], [x0 + W, y0, 0], [x0 + W, y0 + D, 0], [x0, y0 + D, 0]])
  const slabL = poly([[x0, y0 + D, 0], [x0 + W, y0 + D, 0], [x0 + W, y0 + D, -0.7], [x0, y0 + D, -0.7]])
  const slabR = poly([[x0 + W, y0, 0], [x0 + W, y0 + D, 0], [x0 + W, y0 + D, -0.7], [x0 + W, y0, -0.7]])
  const wallL = poly([[x0, y0, 0], [x0, y0 + D, 0], [x0, y0 + D, H], [x0, y0, H]])
  const wallR = poly([[x0, y0, 0], [x0 + W, y0, 0], [x0 + W, y0, H], [x0, y0, H]])
  const wallTop = [iso(x0, y0 + D, H), iso(x0, y0, H), iso(x0 + W, y0, H)].map((p) => p.join(',')).join(' ')
  const rug = poly([[x0 + 1.2, y0 + 4.6, 0.01], [x0 + W - 1.2, y0 + 4.6, 0.01], [x0 + W - 1.2, y0 + 8.8, 0.01], [x0 + 1.2, y0 + 8.8, 0.01]])
  const board = poly([[x0, y0 + 2, 3.3], [x0, y0 + 6.5, 3.3], [x0, y0 + 6.5, 1.5], [x0, y0 + 2, 1.5]])
  const win = poly([[x0 + 5.2, y0, 3.3], [x0 + 8.6, y0, 3.3], [x0 + 8.6, y0, 1.4], [x0 + 5.2, y0, 1.4]])
  const pot = box(x0 + 8.4, y0 + 0.6, 0, 1, 1, 0.8)
  const [lx, ly] = iso(x0 + W - 0.7, y0, H - 0.6)
  const [px, py] = iso(x0 + 8.9, y0 + 1.1, 1.5)

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
      <polygon points={rug} fill={p.color} fillOpacity={active ? 0.14 : 0.06} />

      <polygon points={wallL} fill="#131b35" />
      <polygon points={wallL} fill={p.color} fillOpacity={0.04} />
      <polygon points={wallR} fill="#0f162d" />
      <polyline points={wallTop} fill="none" stroke={p.color} strokeOpacity={0.7} strokeWidth={2} strokeLinejoin="round" />

      <polygon points={board} fill="#1a2341" stroke={p.color} strokeOpacity={0.35} />
      {[2.9, 2.45, 2.0].map((z, i) => {
        const [a, b] = [iso(x0, y0 + 2.6, z), iso(x0, y0 + 2.6 + [3.2, 2.2, 2.8][i], z)]
        return (
          <line
            key={z}
            x1={a[0]}
            y1={a[1]}
            x2={b[0]}
            y2={b[1]}
            stroke={active ? p.color : '#475569'}
            strokeOpacity={active ? 0.9 : 0.5}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        )
      })}

      <polygon points={win} fill="#0a1630" stroke="#334155" />
      {[[6, 2.7], [7.6, 2.2], [6.8, 1.8], [8.1, 3.0]].map(([wx, wz], i) => {
        const [sx, sy] = iso(x0 + wx, y0, wz)
        return <circle key={i} cx={sx} cy={sy} r={0.9} fill="#e2e8f0" opacity={0.7} />
      })}

      <polygon points={pot.top} fill="#7c4a2d" />
      <polygon points={pot.left} fill="#5c361f" />
      <polygon points={pot.right} fill="#4a2b18" />
      <circle cx={px} cy={py} r={7} fill="#15803d" />
      <circle cx={px + 3} cy={py - 4} r={4.5} fill="#22c55e" />

      {deskXs.map((dx) => (
        <Desk key={dx} x={dx} y={y0 + 3} color={p.color} status={status} />
      ))}

      <circle cx={lx} cy={ly} r={3.4} fill={AGENT_META[status].color} className={cx(active && 'lamp-pulse')} />

      <polygon
        points={floor}
        fill="none"
        stroke={p.color}
        strokeOpacity={selected ? 1 : 0.4}
        strokeWidth={selected ? 2.5 : 1.2}
        className={cx(active && 'room-glow')}
        filter={selected || active ? 'url(#glow)' : undefined}
      />
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
  const [cxp, cyp] = iso(x0 + W / 2, y0 + D / 2, 0)
  const meta = AGENT_META[status]

  return (
    <g>
      {last && (
        <foreignObject x={cxp - 100} y={cyp - 132} width={200} height={92} pointerEvents="none">
          <div className="flex h-full items-end justify-center">
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
            <span className="text-[13px] leading-none">{p.icon}</span>
            <span className="truncate font-semibold text-slate-100">{p.name}</span>
            <span className="flex items-center gap-1 pl-1 text-[9px] uppercase tracking-wider" style={{ color: meta.color }}>
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
              {meta.label}
            </span>
          </button>
        </div>
        <div className="mt-0.5 text-center text-[9px] text-slate-500">
          {p.agents} {p.agents === 1 ? 'agente' : 'agentes'}
        </div>
      </foreignObject>
    </g>
  )
}
