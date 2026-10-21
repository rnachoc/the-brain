import { create } from 'zustand'
import { projects } from './config'
import { seed } from './mock/seed'
import type {
  AgentStatus,
  BrainNote,
  LogEntry,
  Order,
  Project,
  RouterNote,
  RouterQuestion,
  Run,
  Schedule,
  ServerEvent,
  Tab,
} from './types'

export interface State {
  projects: Project[]
  runs: Run[]
  orders: Order[]
  logs: LogEntry[]
  schedules: Schedule[]
  notes: BrainNote[]
  question: RouterQuestion | null
  routerNote: RouterNote | null
  connected: boolean
  live: boolean
  tab: Tab
  selectedProjectId: string | null
  chatDraft: string

  setTab: (tab: Tab) => void
  selectProject: (id: string | null) => void
  setChatDraft: (text: string) => void
  send: (text: string) => void
  answerQuestion: (projectIds: string[]) => void
  dismissQuestion: () => void
  approve: (orderId: string) => void
  reject: (orderId: string) => void
  saveNote: (path: string, content: string) => Promise<boolean>
  cancelRun: (runId: string) => void
  toggleSchedule: (id: string) => void
}

const post = (url: string, body?: unknown) =>
  fetch(url, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))

const upsert = <T extends { id: string }>(list: T[], item: T): T[] => {
  const i = list.findIndex((x) => x.id === item.id)
  if (i === -1) return [...list, item]
  const next = list.slice()
  next[i] = item
  return next
}

export const useStore = create<State>()((set) => ({
  projects,
  runs: [],
  orders: [],
  logs: [],
  notes: [],
  ...seed(),
  question: null,
  routerNote: null,
  connected: false,
  live: false,
  tab: 'office',
  selectedProjectId: null,
  chatDraft: '',

  setTab: (tab) => set({ tab }),
  selectProject: (selectedProjectId) => set({ selectedProjectId }),
  setChatDraft: (chatDraft) => set({ chatDraft }),
  send: (text) => {
    if (!text.trim()) return
    set({ chatDraft: '' })
    post('/api/chat', { text }).catch(() => set({ chatDraft: text }))
  },
  answerQuestion: (projectIds) => void post('/api/question/answer', { projectIds }),
  dismissQuestion: () => void post('/api/question/dismiss'),
  approve: (id) => void post(`/api/orders/${id}/approve`),
  reject: (id) => void post(`/api/orders/${id}/reject`),
  saveNote: (path, content) =>
    fetch('/api/brain', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content }),
    }).then((r) => r.ok),
  cancelRun: (id) => void post(`/api/runs/${id}/cancel`),
  toggleSchedule: (id) =>
    set((s) => ({ schedules: s.schedules.map((x) => (x.id === id ? { ...x, enabled: !x.enabled } : x)) })),
}))

// ---------- Tiempo real ----------

function apply(e: ServerEvent) {
  useStore.setState((s) => {
    switch (e.type) {
      case 'snapshot':
        return { ...e.state, connected: true }
      case 'run':
        return { runs: upsert(s.runs, e.run) }
      case 'order':
        return { orders: upsert(s.orders, e.order) }
      case 'log':
        return { logs: [...s.logs.slice(-1999), e.log] }
      case 'question':
        return { question: e.question }
      case 'routed':
        return { routerNote: e.note }
      case 'note': {
        const others = s.notes.filter((n) => n.path !== e.note.path)
        return { notes: [...others, e.note].sort((a, b) => a.path.localeCompare(b.path)) }
      }
    }
  })
}

let retry = 500
function connect() {
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`)
  ws.onmessage = (m) => {
    const e = JSON.parse(m.data) as ServerEvent
    // Solo damos la conexión por buena cuando el servidor responde de verdad.
    if (e.type === 'snapshot') retry = 500
    apply(e)
  }
  ws.onclose = () => {
    useStore.setState({ connected: false })
    setTimeout(connect, (retry = Math.min(retry * 2, 8000)))
  }
}
connect()

// ---------- Selectores derivados ----------
// Devuelven primitivos para no provocar renders de más.

export function agentStatus(s: State, projectId: string): AgentStatus {
  let running = false
  for (const r of s.runs) {
    if (r.projectId !== projectId) continue
    if (r.status === 'waiting') return 'waiting'
    if (r.status === 'running') running = true
  }
  return running ? 'running' : 'idle'
}

export function lastAction(s: State, projectId: string): string | undefined {
  for (let i = s.logs.length - 1; i >= 0; i--) {
    if (s.logs[i].projectId === projectId) return s.logs[i].text
  }
  return undefined
}
