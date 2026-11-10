export function Headline({ employees, title }: { employees: number; title: string }) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-xl bg-[#0d1017]/80 px-5 py-2.5 text-center shadow-lg shadow-black/20 ring-1 ring-inset ring-white/10 backdrop-blur-md">
      <div className="text-[19px] font-semibold tracking-[-0.01em] text-white">
        {employees} {employees === 1 ? 'empleado' : 'empleados'} / <span className="text-[#F5B800]">0</span> humanos
      </div>
      <div className="mt-0.5 text-[12px] text-slate-400">{title}</div>
    </div>
  )
}
