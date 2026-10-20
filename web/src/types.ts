export type Tab = 'office' | 'tasks' | 'calendar' | 'brain'

export type AgentStatus = 'idle' | 'running' | 'waiting'
export type OrderStatus = 'pending' | 'running' | 'awaiting_approval' | 'done' | 'rejected' | 'failed'
export type RunStatus = 'running' | 'waiting' | 'done' | 'failed'
export type LogLevel = 'info' | 'tool' | 'warn' | 'error' | 'approval'

export interface Project {
  id: string
  name: string
  aliases: string[]
  color: string
  icon: string
  agents: number
  folder: string
  description: string
  keywords: string[]
  tools: string[]
  systemPrompt: string
  model?: string
  fallback?: boolean
}

export interface Draft {
  kind: 'email' | 'message' | 'post' | 'payment' | 'other'
  to?: string
  subject?: string
  body: string
}

export interface Order {
  id: string
  runId: string
  projectId: string
  seq: number
  title: string
  status: OrderStatus
  /** Afecta a algo externo: se pausa y pide aprobación. */
  external: boolean
  draft?: Draft
  createdAt: number
  updatedAt: number
}

export interface Run {
  id: string
  projectId: string
  prompt: string
  status: RunStatus
  startedAt: number
  endedAt?: number
}

export interface LogEntry {
  id: string
  projectId: string
  runId?: string
  ts: number
  level: LogLevel
  text: string
}

export type ScheduleRule =
  | { type: 'daily'; time: string }
  | { type: 'weekly'; weekdays: number[]; time: string }
  | { type: 'once'; at: string }

export interface Schedule {
  id: string
  projectId: string
  title: string
  prompt: string
  rule: ScheduleRule
  enabled: boolean
}

export interface BrainNote {
  path: string
  content: string
  updatedAt: number
  updatedBy: string
}

export interface RouterQuestion {
  id: string
  text: string
  prompt: string
  options: string[]
}

export interface RouterNote {
  id: string
  text: string
  ts: number
  projectIds: string[]
}
