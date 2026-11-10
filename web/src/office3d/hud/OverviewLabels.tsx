// Etiquetas flotantes sobre los empleados que no están libres (solo en la vista general).
import { Html } from '@react-three/drei'
import { projectById } from '../../config'
import { agentStatus, employeeLine, useStore } from '../../store'
import { cx } from '../../util'
import type { OfficeLayout } from '../layout'
import { employeeName } from '../look'

const clip = (s: string, n = 32) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

function Label({ id, x, y, z }: { id: string; x: number; y: number; z: number }) {
  const status = useStore((s) => agentStatus(s, id))
  const line = useStore((s) => employeeLine(s, id))
  const select = useStore((s) => s.selectProject)
  if (status === 'idle') return null
  return (
    <Html position={[x, y, z]} center zIndexRange={[5, 0]}>
      <button
        onClick={() => select(id)}
        className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#0d1017]/85 px-2.5 py-1 text-[11px] font-medium text-white shadow-md shadow-black/30 ring-1 ring-inset ring-white/10 backdrop-blur hover:bg-[#0d1017]"
      >
        <span className={cx('h-1.5 w-1.5 rounded-full', status === 'waiting' ? 'bg-[#F5B800]' : 'bg-emerald-400')} />
        <span className="font-semibold">{employeeName(projectById(id))}</span>
        <span className="text-slate-400">· {clip(line)}</span>
      </button>
    </Html>
  )
}

export function OverviewLabels({ layout }: { layout: OfficeLayout }) {
  return (
    <>
      {[...layout.seatOf.values()].map(({ room, seat }) => (
        <Label key={seat.projectId} id={seat.projectId} x={seat.x} y={room.y + 2.75} z={seat.z} />
      ))}
    </>
  )
}
