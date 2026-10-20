import { useMemo } from 'react'
import { agentStatus, useStore } from '../store'
import type { Project } from '../types'
import { AGENT_META, cx } from '../util'
import { box, iso, PITCH, ROOM_D, ROOM_W, roomOrigin, slotFor, WALL_H } from './iso'
import { IsoRoom, RoomOverlay } from './IsoRoom'

interface Placed {
  p: Project
  gx: number
  gy: number
}

function Link({ p, gx, gy }: Placed) {
  const status = useStore((s) => agentStatus(s, p.id))
  const active = status !== 'idle'
  const [ax, ay] = iso(0, 0, 0)
  const [bx, by] = iso(gx * PITCH, gy * PITCH, 0)
  const d = `M ${ax} ${ay} L ${bx} ${by}`
  return (
    <g>
      <path d={d} stroke={p.color} strokeOpacity={active ? 0.75 : 0.14} strokeWidth={active ? 2 : 1.2} strokeDasharray="3 7" className={cx(active && 'flow')} fill="none" />
      {active && (
        <circle r={3} fill={p.color} filter="url(#glow)">
          <animateMotion dur="2.2s" repeatCount="indefinite" path={`M ${bx} ${by} L ${ax} ${ay}`} />
        </circle>
      )}
    </g>
  )
}

function BrainCore() {
  const setTab = useStore((s) => s.setTab)
  const notes = useStore((s) => s.notes.length)
  const anyActive = useStore((s) => s.runs.some((r) => r.status !== 'done' && r.status !== 'failed'))
  const base = box(-3.5, -3.5, -0.7, 7, 7, 0.7)
  const [cx0, cy0] = iso(0, 0, 0)
  const [sx, sy] = iso(0, 0, 3.4)
  const ring = (r: number) => ({ rx: r * Math.SQRT2 * Math.cos(Math.PI / 6) * 14, ry: r * Math.SQRT2 * 0.5 * 14 })
  const r1 = ring(2.6)
  const r2 = ring(3.3)
  const [lx, ly] = iso(3.5, 3.5, -0.7)

  return (
    <g className="cursor-pointer" onClick={() => setTab('brain')}>
      <polygon points={base.left} fill="#0c1024" />
      <polygon points={base.right} fill="#10152d" />
      <polygon points={base.top} fill="url(#brainFloor)" stroke="#8b5cf6" strokeOpacity={0.5} />
      <ellipse cx={cx0} cy={cy0} {...r2} fill="none" stroke="#22d3ee" strokeOpacity={0.35} strokeDasharray="2 6" className="spin-slow" />
      <ellipse cx={cx0} cy={cy0} {...r1} fill="#8b5cf6" fillOpacity={0.12} stroke="#a78bfa" strokeOpacity={0.6} />
      <line x1={cx0} y1={cy0} x2={sx} y2={sy} stroke="#a78bfa" strokeOpacity={0.5} strokeWidth={6} />
      <ellipse cx={sx} cy={cy0} rx={14} ry={7} fill="#a78bfa" opacity={0.25} filter="url(#glow)" />
      <g className={cx('brain-pulse', anyActive && 'brain-fast')}>
        <circle cx={sx} cy={sy} r={34} fill="#7c3aed" opacity={0.18} filter="url(#glowBig)" />
        <circle cx={sx} cy={sy} r={25} fill="url(#brainSphere)" />
        <ellipse cx={sx} cy={sy} rx={25} ry={8} fill="none" stroke="#e9d5ff" strokeOpacity={0.25} />
        <ellipse cx={sx} cy={sy} rx={9} ry={25} fill="none" stroke="#e9d5ff" strokeOpacity={0.2} />
        <ellipse cx={sx} cy={sy} rx={18} ry={25} fill="none" stroke="#e9d5ff" strokeOpacity={0.12} />
        <circle cx={sx - 8} cy={sy - 9} r={6} fill="#fff" opacity={0.25} />
      </g>
      <circle r={2.5} fill="#22d3ee" filter="url(#glow)">
        <animateMotion
          dur="7s"
          repeatCount="indefinite"
          path={`M ${sx - 40} ${sy} a 40 13 0 1 0 80 0 a 40 13 0 1 0 -80 0`}
        />
      </circle>
      <foreignObject x={lx - 80} y={ly + 4} width={160} height={40}>
        <div className="flex flex-col items-center">
          <div className="rounded-md border border-violet-400/40 bg-violet-950/70 px-2.5 py-1 text-[11px] font-semibold tracking-[0.2em] text-violet-200 backdrop-blur">
            THE BRAIN
          </div>
          <div className="mt-0.5 text-[9px] text-slate-500">{notes} notas compartidas</div>
        </div>
      </foreignObject>
    </g>
  )
}

export function Office() {
  const projects = useStore((s) => s.projects)
  const placed: Placed[] = useMemo(
    () =>
      projects.map((p, i) => {
        const [gx, gy] = slotFor(i)
        return { p, gx, gy }
      }),
    [projects],
  )

  const viewBox = useMemo(() => {
    let minX = -80, maxX = 80, minY = -120, maxY = 80
    for (const { gx, gy } of placed) {
      const [x0, y0] = roomOrigin(gx, gy)
      const pts = [
        iso(x0, y0 + ROOM_D, 0),
        iso(x0 + ROOM_W, y0, 0),
        iso(x0, y0, WALL_H + 1),
        iso(x0 + ROOM_W, y0 + ROOM_D, -0.7),
      ]
      for (const [x, y] of pts) {
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y + 56)
      }
    }
    const pad = 24
    return `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`
  }, [placed])

  // Pintamos de atrás hacia delante (gx + gy) para que el solapamiento sea correcto.
  const items = useMemo(
    () =>
      [
        ...placed.map((x) => ({ depth: x.gx + x.gy, key: x.p.id, node: <IsoRoom key={x.p.id} project={x.p} gx={x.gx} gy={x.gy} /> })),
        { depth: 0, key: '__brain', node: <BrainCore key="__brain" /> },
      ].sort((a, b) => a.depth - b.depth),
    [placed],
  )

  return (
    <div className="absolute inset-0 overflow-hidden">
      <svg viewBox={viewBox} className="h-full w-full select-none" preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glowBig" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="12" />
          </filter>
          <radialGradient id="brainSphere" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#f5d0fe" />
            <stop offset="35%" stopColor="#a78bfa" />
            <stop offset="75%" stopColor="#6d28d9" />
            <stop offset="100%" stopColor="#1e1b4b" />
          </radialGradient>
          <linearGradient id="brainFloor" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1e1b4b" />
            <stop offset="100%" stopColor="#0c1a2e" />
          </linearGradient>
        </defs>
        <g>{placed.map((x) => <Link key={x.p.id} {...x} />)}</g>
        {items.map((i) => i.node)}
        {placed.map((x) => (
          <RoomOverlay key={x.p.id} project={x.p} gx={x.gx} gy={x.gy} />
        ))}
      </svg>
      <div className="pointer-events-none absolute bottom-3 left-4 flex gap-4 text-[11px] text-slate-500">
        {Object.values(AGENT_META).map((m) => (
          <span key={m.label} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />
            {m.label}
          </span>
        ))}
      </div>
    </div>
  )
}
