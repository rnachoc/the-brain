// Oficina 3D: edificio en corte con una sala por departamento y la cámara que vuela entre ellas.
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { useCallback, useEffect, useMemo } from 'react'
import { useStore } from '../store'
import { Building } from './Building'
import { CameraRig, FOV, type Focus } from './CameraRig'
import { FloorChip } from './hud/FloorChip'
import { Headline } from './hud/Headline'
import { buildLayout, roomLabel, type RoomLayout } from './layout'
import { Room, type ScreenContent } from './Room'
import { useOffice } from './state'

const TITLE = 'Mi oficina de agentes de IA'

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

export default function Office3D() {
  const projects = useStore((s) => s.projects)
  const notes = useStore((s) => s.notes.length)
  const setTab = useStore((s) => s.setTab)
  const roomId = useOffice((s) => s.room)
  const setRoom = useOffice((s) => s.setRoom)
  const layout = useMemo(() => buildLayout(projects), [projects])
  const allRooms = useMemo(() => [layout.atrium, ...layout.rooms, layout.tower], [layout])
  const room = allRooms.find((r) => r.id === roomId) ?? null

  const focus: Focus = useMemo(() => (room ? { kind: 'room', room } : { kind: 'overview' }), [room])

  const back = useCallback(() => setRoom(null), [setRoom])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && back()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [back])

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: 'linear-gradient(180deg, #8dbbdc 0%, #c4dce8 48%, #e9eee4 100%)' }}>
      <Canvas
        shadows
        flat
        dpr={[1, 2]}
        camera={{ fov: FOV, near: 0.5, far: 500, position: [0, 14, 80] }}
        gl={{ antialias: true, alpha: true }}
        onPointerMissed={() => undefined}
      >
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
        <CameraRig focus={focus} layout={layout} />
      </Canvas>
      <Headline employees={projects.length} title={TITLE} />
      {room && <FloorChip label={roomLabel(room)} onBack={back} />}
    </div>
  )
}
