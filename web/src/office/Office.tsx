import { useMemo } from 'react'
import { agentStatus, useStore } from '../store'
import type { Project } from '../types'
import { AGENT_META, cx } from '../util'
import { iso, PITCH, slotFor } from './iso'
import { placeLabels, roomHull } from './labels'
import { IsoRoom, RoomOverlay } from './IsoRoom'
import { HoloCore } from './HoloCore'

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
  const [cx0, cy0] = iso(0, 0, 0)
  const [sx, sy] = iso(0, 0, 3.4)
  const [lx, ly] = iso(3.5, 3.5, -0.7)

  return (
    <g className="cursor-pointer" onClick={() => setTab('brain')}>
      <HoloCore sx={sx} sy={sy} cx0={cx0} cy0={cy0} active={anyActive} />
      <foreignObject x={lx - 80} y={ly + 4} width={160} height={40}>
        <div className="flex flex-col items-center">
          <div className="rounded-md border border-violet-400/40 bg-violet-950/70 px-2.5 py-1 font-pixel text-[13px] tracking-[0.16em] text-violet-100 backdrop-blur">
            THE BRAIN
          </div>
          <div className="mt-1 font-pixel text-[10px] text-slate-500">{notes} notas compartidas</div>
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

  const labels = useMemo(() => placeLabels(placed), [placed])

  const viewBox = useMemo(() => {
    let minX = -100, maxX = 100, minY = -120, maxY = 80
    const add = (x: number, y: number) => {
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
    for (const { gx, gy } of placed) for (const [x, y] of roomHull(gx, gy)) add(x, y)
    for (const r of labels.values()) {
      add(r.x, r.y)
      add(r.x + r.w, r.y + r.h)
    }
    const pad = 20
    return `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`
  }, [placed, labels])

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
          <linearGradient id="beam" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
          </linearGradient>
        </defs>
        <g>{placed.map((x) => <Link key={x.p.id} {...x} />)}</g>
        {items.map((i) => i.node)}
        {placed.map((x) => (
          <RoomOverlay key={x.p.id} project={x.p} gx={x.gx} gy={x.gy} label={labels.get(x.p.id)!} />
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
