import { create } from 'zustand'
import { projects } from './config'
import { createEngine } from './mock/engine'
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
  saveNote: (path: string, content: string) => void
  toggleSchedule: (id: string) => void
}

export const useStore = create<State>()((set, get) => {
  const engine = createEngine(get, set)
  setTimeout(engine.boot, 0)

  return {
    projects,
    ...seed(),
    question: null,
    routerNote: null,
    tab: 'office',
    selectedProjectId: null,
    chatDraft: '',

    setTab: (tab) => set({ tab }),
    selectProject: (selectedProjectId) => set({ selectedProjectId }),
    setChatDraft: (chatDraft) => set({ chatDraft }),
    send: (text) => {
      if (!text.trim()) return
      set({ chatDraft: '' })
      engine.dispatch(text)
    },
    answerQuestion: (ids) => engine.answer(ids),
    dismissQuestion: () => set({ question: null }),
    approve: (id) => engine.resolve(id, true),
    reject: (id) => engine.resolve(id, false),
    saveNote: (path, content) =>
      set((s) => {
        const note = { path, content, updatedAt: Date.now(), updatedBy: 'tú' }
        const exists = s.notes.some((n) => n.path === path)
        return { notes: exists ? s.notes.map((n) => (n.path === path ? note : n)) : [...s.notes, note] }
      }),
    toggleSchedule: (id) =>
      set((s) => ({ schedules: s.schedules.map((x) => (x.id === id ? { ...x, enabled: !x.enabled } : x)) })),
  }
})

// Selectores derivados: devuelven primitivos para no provocar renders de más.
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
