// Subtítulo del jefe de gabinete: a quién ha pasado lo último y, si duda, la pregunta con sus opciones.
import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { office, projectById } from '../../config'
import { useStore } from '../../store'
import { employeeName } from '../look'

const list = (names: string[]) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`)

export function ChiefLine() {
  const note = useStore((s) => s.routerNote)
  const question = useStore((s) => s.question)
  const answer = useStore((s) => s.answerQuestion)
  const dismiss = useStore((s) => s.dismissQuestion)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!note) return
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 5000)
    return () => clearTimeout(t)
  }, [note])

  const name = office.chief.name
  if (question)
    return (
      <div className="pointer-events-auto max-w-[min(640px,calc(100vw-2rem))] rounded-xl bg-[#0d1017]/90 px-4 py-3 text-center shadow-2xl shadow-black/40 ring-1 ring-inset ring-[#F5B800]/30 backdrop-blur-md">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 text-[14px] text-white">
            <span className="font-semibold text-[#F5B800]">{name}:</span> {question.text}
            <div className="mt-0.5 truncate text-[12px] text-slate-500">«{question.prompt}»</div>
          </div>
          <button onClick={dismiss} className="rounded-md p-1 text-slate-500 hover:bg-white/10 hover:text-white" aria-label="Cancelar">
            <X size={15} />
          </button>
        </div>
        <div className="mt-2.5 flex flex-wrap justify-center gap-2">
          {question.options.map((id) => {
            const p = projectById(id)
            return (
              <button
                key={id}
                onClick={() => answer([id])}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 text-[12px] font-medium text-slate-100 ring-1 ring-inset ring-white/10 hover:bg-[#F5B800] hover:text-[#1b1406]"
              >
                {employeeName(p)} <span className="opacity-60">· {p.name}</span>
              </button>
            )
          })}
        </div>
      </div>
    )

  if (!note || !visible) return null
  const names = note.projectIds.map((id) => employeeName(projectById(id)))
  return (
    <div className="pointer-events-none rounded-xl bg-[#0d1017]/85 px-4 py-2 text-[14px] text-white shadow-lg shadow-black/30 ring-1 ring-inset ring-white/10 backdrop-blur-md">
      <span className="font-semibold text-[#F5B800]">{name}:</span> {names.length ? `Se lo paso a ${list(names)}.` : note.text}
    </div>
  )
}
