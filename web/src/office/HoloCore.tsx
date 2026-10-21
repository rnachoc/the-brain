import { box } from './iso'

interface CoreProps {
  sx: number
  sy: number
  cx0: number
  cy0: number
  active: boolean
}

const ell = (r: number) => ({ rx: r * Math.SQRT2 * Math.cos(Math.PI / 6) * 14, ry: r * Math.SQRT2 * 0.5 * 14 })

function Pedestal({ size, h, glow = '#22d3ee' }: { size: number; h: number; glow?: string }) {
  const b = box(-size / 2, -size / 2, -0.7, size, size, h)
  return (
    <g>
      <polygon points={b.left} fill="#0d1226" />
      <polygon points={b.right} fill="#111733" />
      <polygon points={b.top} fill="#161d3a" stroke={glow} strokeOpacity={0.7} strokeWidth={1.2} />
    </g>
  )
}

/** Núcleo central: un emisor en el suelo proyecta un cerebro holográfico. */
export function HoloCore({ sx, sy, cx0, cy0, active }: CoreProps) {
  const e1 = ell(2.6)
  const e2 = ell(1.7)
  const bx = sx
  const by = sy + 2
  const dur = (s: number) => `${active ? s / 2 : s}s`
  const lh = `M ${bx - 2} ${by - 24} C ${bx - 22} ${by - 28}, ${bx - 34} ${by - 10}, ${bx - 28} ${by + 6} C ${bx - 24} ${by + 18}, ${bx - 8} ${by + 20}, ${bx - 2} ${by + 12} Z`
  const rh = `M ${bx + 2} ${by - 24} C ${bx + 22} ${by - 28}, ${bx + 34} ${by - 10}, ${bx + 28} ${by + 6} C ${bx + 24} ${by + 18}, ${bx + 8} ${by + 20}, ${bx + 2} ${by + 12} Z`
  const gyri = [
    `M ${bx - 24} ${by - 8} q 8 -6 16 0 q 6 5 12 -2`,
    `M ${bx - 26} ${by + 4} q 9 4 18 -2`,
    `M ${bx + 6} ${by - 12} q 8 -6 18 0`,
    `M ${bx + 8} ${by + 2} q 9 -4 18 4`,
  ]
  return (
    <g>
      <Pedestal size={3.6} h={0.5} />
      <ellipse cx={cx0} cy={cy0 - 3} {...e1} fill="#22d3ee" fillOpacity={0.06} stroke="#22d3ee" strokeOpacity={0.5} />
      <ellipse cx={cx0} cy={cy0 - 3} {...e2} fill="none" stroke="#22d3ee" strokeOpacity={0.5} strokeDasharray="3 4" className="spin-slow" />
      {[0, 1].map((k) => (
        <ellipse key={k} cx={cx0} cy={cy0 - 3} fill="none" stroke="#67e8f9" strokeWidth={1.2}>
          <animate attributeName="rx" from={10} to={e1.rx * 1.25} dur={dur(3)} begin={`${k * 1.5}s`} repeatCount="indefinite" />
          <animate attributeName="ry" from={5} to={e1.ry * 1.25} dur={dur(3)} begin={`${k * 1.5}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" from={0.8} to={0} dur={dur(3)} begin={`${k * 1.5}s`} repeatCount="indefinite" />
        </ellipse>
      ))}
      <ellipse cx={cx0} cy={cy0 - 3} rx={10} ry={5} fill="#a5f3fc" filter="url(#glow)" className="core-pulse" />
      <polygon points={`${cx0 - 9},${cy0 - 3} ${cx0 + 9},${cy0 - 3} ${bx + 34},${by + 2} ${bx - 34},${by + 2}`} fill="url(#beam)" opacity={active ? 0.75 : 0.4} className="core-pulse" />
      <circle cx={bx} cy={by - 4} r={34} fill="#22d3ee" opacity={0.12} filter="url(#glowBig)" />
      <clipPath id="holoClip">
        <path d={lh} />
        <path d={rh} />
      </clipPath>
      <g className="core-float">
        <g className="holo-flicker">
          <path d={lh} fill="#22d3ee" fillOpacity={0.14} stroke="#67e8f9" strokeWidth={1.4} />
          <path d={rh} fill="#a78bfa" fillOpacity={0.14} stroke="#c4b5fd" strokeWidth={1.4} />
          {gyri.map((d, i) => (
            <path key={i} d={d} fill="none" stroke={i < 2 ? '#67e8f9' : '#c4b5fd'} strokeOpacity={0.7} strokeWidth={1} />
          ))}
          <line x1={bx} y1={by - 24} x2={bx} y2={by + 12} stroke="#e0f2fe" strokeOpacity={0.5} />
        </g>
        <g clipPath="url(#holoClip)">
          <rect x={bx - 36} width={72} height={3} fill="#e0f2fe" opacity={0.55}>
            <animate attributeName="y" values={`${by - 30};${by + 20};${by - 30}`} dur={dur(4)} repeatCount="indefinite" />
          </rect>
        </g>
        {gyri.map((d, i) => (
          <circle key={i} r={1.8} fill="#fff" filter="url(#glow)">
            <animateMotion dur={dur(1.6 + i * 0.4)} repeatCount="indefinite" keyPoints="0;1;0" keyTimes="0;0.5;1" calcMode="linear" path={d} />
          </circle>
        ))}
      </g>
    </g>
  )
}
