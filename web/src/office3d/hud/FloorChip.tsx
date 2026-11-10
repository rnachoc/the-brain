import { ArrowLeft } from 'lucide-react'

export function FloorChip({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <div className="absolute left-4 top-4 z-10 flex items-center gap-1 rounded-xl bg-[#0d1017]/80 p-1 pr-3.5 shadow-lg shadow-black/20 ring-1 ring-inset ring-white/10 backdrop-blur-md">
      <button
        onClick={onBack}
        title="Vista general (Esc)"
        className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
      >
        <ArrowLeft size={15} />
      </button>
      <span className="text-[13px] font-semibold text-white">{label}</span>
    </div>
  )
}
