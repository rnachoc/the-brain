export type Tab = 'office' | 'tasks' | 'automations' | 'calendar' | 'brain'

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
  /** Con Claude conectado todos los agentes son reales; live: false lo deja simulado. */
  live?: boolean
  /** Planta del edificio. Los proyectos con el mismo department comparten sala. */
  department?: string
  /** Nombre del empleado (p. ej. "Tomás"). Por defecto se asigna uno estable a partir del id. */
  agentName?: string
  /** Cargo que se ve en la tarjeta. Por defecto, el name del proyecto. */
  role?: string
  /** Enlace al proyecto en claude.ai para el botón "Abrir en Claude". */
  claudeUrl?: string
  /** Carga el CLAUDE.md y los ajustes del repo de `folder` (settingSources: ['project']). */
  inheritProjectSettings?: boolean
  /** Comandos fijos que el servidor puede ejecutar tras tu aprobación. */
  actions?: ProjectAction[]
}

export interface ProjectAction {
  id: string
  label: string
  /** Comando fijo escrito por ti; se ejecuta en `folder`. */
  command: string
  /** Límite de tiempo; por defecto 900 s. */
  timeoutSec?: number
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
  /** Acción del proyecto que el servidor ejecutará si apruebas. */
  action?: { id: string; label: string }
  note?: string
  createdAt: number
  updatedAt: number
}

export interface Run {
  id: string
  projectId: string
  prompt: string
  status: RunStatus
  /** true = Claude Agent SDK, false = agente simulado. */
  live: boolean
  startedAt: number
  endedAt?: number
  result?: string
  costUsd?: number
}

export interface LogEntry {
  id: string
  projectId: string
  runId?: string
  ts: number
  level: LogLevel
  text: string
  /** Entrada completa (p. ej. el input de una herramienta) para el log de auditoría. */
  detail?: string
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
  lastRunAt?: number
  createdAt?: number
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

/** Señal que escribe un proyecto en <folder>/.brain/status.json. The Brain solo la lee. */
export interface ProjectSignal {
  updatedAt: string
  headline: string
  tone: 'ok' | 'warn' | 'error'
  items: { label: string; value: string; delta?: string }[]
  /** Rutas relativas a la carpeta del proyecto (Markdown e imagen jpg/png). */
  report?: string
  image?: string
  /** Fecha de modificación del archivo, en ms. */
  mtime: number
}

/** Tarea programada de Claude Desktop (solo lectura). */
export interface ClaudeTask {
  id: string
  name: string
  description: string
  updatedAt: number
  body: string
}

// ---------- Protocolo servidor ↔ web ----------

export interface Snapshot {
  runs: Run[]
  orders: Order[]
  logs: LogEntry[]
  notes: BrainNote[]
  schedules: Schedule[]
  /** Interruptor general: con true no se lanza ninguna tarea programada. */
  schedulesPaused: boolean
  question: RouterQuestion | null
  /** Señal más reciente de cada proyecto que tiene .brain/status.json. */
  signals: Record<string, ProjectSignal>
  /** Hay API key: el router y los agentes live usan Claude. */
  live: boolean
}

export type ServerEvent =
  | { type: 'snapshot'; state: Snapshot }
  | { type: 'run'; run: Run }
  | { type: 'order'; order: Order }
  | { type: 'log'; log: LogEntry }
  | { type: 'question'; question: RouterQuestion | null }
  | { type: 'routed'; note: RouterNote }
  | { type: 'note'; note: BrainNote }
  | { type: 'schedule'; schedule: Schedule }
  | { type: 'scheduleRemoved'; id: string }
  | { type: 'schedulesPaused'; paused: boolean }
  | { type: 'signal'; projectId: string; signal: ProjectSignal | null }
