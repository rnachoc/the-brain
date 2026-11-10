import { lazy, Suspense } from 'react'
import { AgentPanel } from './components/AgentPanel'
import { ChatBar } from './components/ChatBar'
import { OrderQueue } from './components/OrderQueue'
import { TopBar } from './components/TopBar'
import { useStore } from './store'
import { BrainView } from './views/BrainView'
import { CalendarView } from './views/CalendarView'
import { TasksView } from './views/TasksView'

// three solo se descarga al abrir la oficina.
const Office3D = lazy(() => import('./office3d/Office3D'))

export default function App() {
  const tab = useStore((s) => s.tab)
  return (
    <div className="space-bg flex h-screen flex-col overflow-hidden text-slate-200">
      {tab !== 'office' && <div className="stars pointer-events-none fixed inset-0" />}
      <TopBar />
      <main className="relative min-h-0 flex-1">
        {tab === 'office' && (
          <Suspense fallback={null}>
            <Office3D />
          </Suspense>
        )}
        {tab === 'tasks' && <TasksView />}
        {tab === 'calendar' && <CalendarView />}
        {tab === 'brain' && <BrainView />}
        <AgentPanel />
      </main>
      <div className="relative z-20">
        <OrderQueue />
        <ChatBar />
      </div>
    </div>
  )
}
