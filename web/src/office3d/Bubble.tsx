// Globo sobre la cabeza: "…" mientras trabaja, "!" ámbar cuando espera tu decisión.
import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { canvasTexture } from './kit'

function bubble(fill: string, draw: (ctx: CanvasRenderingContext2D) => void) {
  const tex = canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = fill
    ctx.beginPath()
    ctx.arc(64, 56, 46, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(44, 92)
    ctx.lineTo(34, 122)
    ctx.lineTo(66, 100)
    ctx.fill()
    draw(ctx)
  })
  return new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false })
}

const DOTS = bubble('#1d2230', (ctx) => {
  ctx.fillStyle = '#5eead4'
  for (const x of [40, 64, 88]) {
    ctx.beginPath()
    ctx.arc(x, 56, 8, 0, Math.PI * 2)
    ctx.fill()
  }
})

const ALERT = bubble('#F5B800', (ctx) => {
  ctx.fillStyle = '#1b1406'
  ctx.fillRect(57, 24, 14, 40)
  ctx.fillRect(57, 72, 14, 14)
})

export function Bubble({ kind, y }: { kind: 'dots' | 'alert'; y: number }) {
  const ref = useRef<THREE.Group>(null)
  const phase = useRef(Math.random() * 6)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = y + Math.sin(clock.elapsedTime * 2.4 + phase.current) * 0.05
  })
  return (
    <group ref={ref} position={[0.25, y, 0]}>
      <Billboard>
        <mesh material={kind === 'alert' ? ALERT : DOTS} scale={kind === 'alert' ? 0.62 : 0.5} renderOrder={10}>
          <planeGeometry />
        </mesh>
      </Billboard>
    </group>
  )
}
