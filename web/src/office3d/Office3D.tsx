// Oficina 3D: edificio en corte con una sala por departamento y la cámara que vuela entre ellas.
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { office } from '../config'
import { agentStatus, useStore } from '../store'
import type { Project } from '../types'
import { Building } from './Building'
import { CameraRig, FOV, seatFocus, type Focus } from './CameraRig'
import { BlockPerson, Employee } from './Character'
import { AgentCard } from './hud/AgentCard'
import { ChiefLine } from './hud/ChiefLine'
import { Filters } from './hud/Filters'
import { FloorChip } from './hud/FloorChip'
import { Headline } from './hud/Headline'
import { OverviewLabels } from './hud/OverviewLabels'
import { buildLayout, roomLabel, type OfficeLayout, type RoomLayout, type Seat } from './layout'
import { Fallback } from './Fallback'
import { CHIEF_LOOK, lookFor } from './look'
import { Room, ScreenTicker, type ScreenContent } from './Room'
import { useOffice } from './state'

const WEBGL = (() => {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
})()

/** Ignora los clics que en realidad eran arrastres para girar la cámara. */
const isClick = (e: ThreeEvent<MouseEvent>) => e.delta < 6

function useRoomScreen(room: RoomLayout): ScreenContent {
  const projects = useStore((s) => s.projects)
  return useMemo(() => {
    const ps = room.projectIds.map((id) => projects.find((p) => p.id === id)!).filter(Boolean)
    return {
      title: room.name,
      subtitle: room.lounge ? 'Zona común' : `${ps.length} ${ps.length === 1 ? 'empleado' : 'empleados'}`,
      lines: ps.map((p) => ({ label: p.name })),
    }
  }, [room, projects])
}

function RoomNode({ room, focused, onPick }: { room: RoomLayout; focused: boolean; onPick: (r: RoomLayout) => void }) {
  const screen = useRoomScreen(room)
  return (
    <Room
      room={room}
      screen={screen}
      onPick={(e) => {
        e.stopPropagation()
        if (isClick(e) && !focused) onPick(room)
      }}
    />
  )
}

function SeatedEmployee({ p, room, seat, selected }: { p: Project; room: RoomLayout; seat: Seat; selected: boolean }) {
  const status = useStore((s) => agentStatus(s, p.id))
  const filter = useOffice((s) => s.filter)
  const select = useStore((s) => s.selectProject)
  const look = useMemo(() => lookFor(p.id, p.color), [p.id, p.color])
  return <Employee look={look} status={status} x={seat.x} y={room.y} z={seat.z} rot={seat.rot} selected={selected} dim={filter !== 'all' && filter !== status} onSelect={() => select(p.id)} />
}

/** Jefe de gabinete en el atrio: gira hacia el último empleado al que ha pasado algo. */
function Chief({ layout, onPick }: { layout: OfficeLayout; onPick: () => void }) {
  const target = useStore((s) => s.routerNote?.projectIds[0])
  const ref = useRef<THREE.Group>(null)
  const { x, z } = layout.chief
  const y = layout.atrium.y
  const angle = useMemo(() => {
    const t = target && layout.seatOf.get(target)
    return t ? Math.atan2(t.seat.x - x, t.seat.z - z) : 0.25
  }, [target, layout, x, z])
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += (angle - ref.current.rotation.y) * (1 - Math.exp(-Math.min(dt, 0.1) * 4))
  })
  return (
    <group
      ref={ref}
      position={[x, y, z]}
      onClick={(e) => {
        e.stopPropagation()
        if (isClick(e)) onPick()
      }}
    >
      <BlockPerson look={CHIEF_LOOK} sitting={false} action="hold" />
    </group>
  )
}

export default function Office3D() {
  const projects = useStore((s) => s.projects)
  const notes = useStore((s) => s.notes.length)
  const setTab = useStore((s) => s.setTab)
  const selected = useStore((s) => s.selectedProjectId)
  const select = useStore((s) => s.selectProject)
  const roomId = useOffice((s) => s.room)
  const setRoom = useOffice((s) => s.setRoom)
  const layout = useMemo(() => buildLayout(projects), [projects])
  const allRooms = useMemo(() => [layout.atrium, ...layout.rooms, layout.tower], [layout])
  const room = allRooms.find((r) => r.id === roomId) ?? null
  const picked = selected ? layout.seatOf.get(selected) : undefined

  const focus: Focus = useMemo(
    () => (picked ? seatFocus(picked.room, picked.seat) : room ? { kind: 'room', room } : { kind: 'overview' }),
    [picked, room],
  )
  const chipRoom = picked?.room ?? room

  const back = useCallback(() => {
    setRoom(null)
    select(null)
  }, [setRoom, select])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && back()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [back])

  if (!WEBGL) return <Fallback onOverview={back} />

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: 'linear-gradient(180deg, #8dbbdc 0%, #c4dce8 48%, #e9eee4 100%)' }}>
      <Canvas shadows flat dpr={[1, 2]} camera={{ fov: FOV, near: 0.3, far: 500, position: [0, 14, 80] }} gl={{ antialias: true, alpha: true }}>
        <hemisphereLight args={['#fffaf0', '#7d8a63', 1.5]} />
        <directionalLight
          position={[16, 30, 24]}
          intensity={2.2}
          color="#fff3df"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-24}
          shadow-camera-right={24}
          shadow-camera-top={26}
          shadow-camera-bottom={-12}
          shadow-camera-near={1}
          shadow-camera-far={90}
          shadow-bias={-0.0004}
          shadow-normalBias={0.02}
        />
        <Building
          layout={layout}
          notes={notes}
          onTower={(e) => {
            e.stopPropagation()
            if (isClick(e)) setTab('brain')
          }}
        />
        {[layout.atrium, ...layout.rooms].map((r) => (
          <RoomNode key={r.id} room={r} focused={roomId === r.id} onPick={(x) => setRoom(x.id)} />
        ))}
        {projects.map((p) => {
          const at = layout.seatOf.get(p.id)
          return at && <SeatedEmployee key={p.id} p={p} room={at.room} seat={at.seat} selected={selected === p.id} />
        })}
        <Chief layout={layout} onPick={() => (select(null), setRoom('atrium'))} />
        {focus.kind === 'overview' && <OverviewLabels layout={layout} />}
        <ScreenTicker />
        <CameraRig focus={focus} layout={layout} />
      </Canvas>
      <Headline employees={projects.length} title={office.title} />
      {chipRoom && <FloorChip label={roomLabel(chipRoom)} onBack={back} />}
      <div className="pointer-events-none absolute bottom-4 left-4 z-10 flex flex-col items-start gap-2">
        {picked && selected && <AgentCard key={selected} projectId={selected} onClose={() => select(null)} />}
        <Filters onOverview={back} />
      </div>
      <div className="pointer-events-none absolute bottom-16 left-1/2 z-10 -translate-x-1/2">
        <ChiefLine />
      </div>
    </div>
  )
}
