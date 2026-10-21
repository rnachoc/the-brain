// Persistencia en SQLite con el módulo nativo de Node (sin compilar nada).
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import type { Draft, LogEntry, LogLevel, Order, Run, Schedule, ScheduleRule } from '../../shared/types'
import { DATA_DIR } from './config'

mkdirSync(DATA_DIR, { recursive: true })
const db = new DatabaseSync(join(DATA_DIR, 'the-brain.db'))

db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY, text TEXT NOT NULL, ts INTEGER NOT NULL, routed_to TEXT
  );
  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, prompt TEXT NOT NULL, status TEXT NOT NULL,
    live INTEGER NOT NULL, started_at INTEGER NOT NULL, ended_at INTEGER, result TEXT, cost_usd REAL
  );
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY, run_id TEXT NOT NULL, project_id TEXT NOT NULL, seq INTEGER NOT NULL,
    title TEXT NOT NULL, status TEXT NOT NULL, external INTEGER NOT NULL, draft TEXT, note TEXT,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL, run_id TEXT,
    ts INTEGER NOT NULL, level TEXT NOT NULL, text TEXT NOT NULL, detail TEXT
  );
  CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL, prompt TEXT NOT NULL,
    rule TEXT NOT NULL, enabled INTEGER NOT NULL, last_run_at INTEGER, created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS orders_run ON orders(run_id);
  CREATE INDEX IF NOT EXISTS logs_project ON logs(project_id);
`)

type Row = Record<string, SQLInputValue>

const toRun = (r: Row): Run => ({
  id: r.id as string,
  projectId: r.project_id as string,
  prompt: r.prompt as string,
  status: r.status as Run['status'],
  live: !!r.live,
  startedAt: Number(r.started_at),
  endedAt: r.ended_at == null ? undefined : Number(r.ended_at),
  result: (r.result as string) ?? undefined,
  costUsd: r.cost_usd == null ? undefined : Number(r.cost_usd),
})

const toOrder = (r: Row): Order => ({
  id: r.id as string,
  runId: r.run_id as string,
  projectId: r.project_id as string,
  seq: Number(r.seq),
  title: r.title as string,
  status: r.status as Order['status'],
  external: !!r.external,
  draft: r.draft ? (JSON.parse(r.draft as string) as Draft) : undefined,
  note: (r.note as string) ?? undefined,
  createdAt: Number(r.created_at),
  updatedAt: Number(r.updated_at),
})

const toLog = (r: Row): LogEntry => ({
  id: String(r.id),
  projectId: r.project_id as string,
  runId: (r.run_id as string) ?? undefined,
  ts: Number(r.ts),
  level: r.level as LogLevel,
  text: r.text as string,
  detail: (r.detail as string) ?? undefined,
})

const toSchedule = (r: Row): Schedule => ({
  id: r.id as string,
  projectId: r.project_id as string,
  title: r.title as string,
  prompt: r.prompt as string,
  rule: JSON.parse(r.rule as string) as ScheduleRule,
  enabled: !!r.enabled,
  lastRunAt: r.last_run_at == null ? undefined : Number(r.last_run_at),
  createdAt: Number(r.created_at),
})

export const repo = {
  listSchedules(): Schedule[] {
    return (db.prepare('SELECT * FROM schedules ORDER BY created_at').all() as Row[]).map(toSchedule)
  },
  getSchedule(id: string): Schedule | undefined {
    const r = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id) as Row | undefined
    return r && toSchedule(r)
  },
  upsertSchedule(s: Schedule) {
    db.prepare(
      'INSERT INTO schedules (id, project_id, title, prompt, rule, enabled, last_run_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ' +
        'ON CONFLICT(id) DO UPDATE SET project_id = excluded.project_id, title = excluded.title, prompt = excluded.prompt, rule = excluded.rule, enabled = excluded.enabled, last_run_at = excluded.last_run_at',
    ).run(s.id, s.projectId, s.title, s.prompt, JSON.stringify(s.rule), s.enabled ? 1 : 0, s.lastRunAt ?? null, s.createdAt ?? Date.now())
  },
  deleteSchedule(id: string) {
    db.prepare('DELETE FROM schedules WHERE id = ?').run(id)
  },
  getSetting(key: string): string | undefined {
    const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as Row | undefined
    return r?.value as string | undefined
  },
  setSetting(key: string, value: string) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
  },

  insertMessage(id: string, text: string, ts: number) {
    db.prepare('INSERT INTO messages (id, text, ts) VALUES (?, ?, ?)').run(id, text, ts)
  },
  setMessageRouting(id: string, projectIds: string[]) {
    db.prepare('UPDATE messages SET routed_to = ? WHERE id = ?').run(projectIds.join(','), id)
  },

  insertRun(r: Run) {
    db.prepare('INSERT INTO runs (id, project_id, prompt, status, live, started_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      r.id, r.projectId, r.prompt, r.status, r.live ? 1 : 0, r.startedAt,
    )
  },
  updateRun(id: string, p: Partial<Run>): Run {
    const cur = repo.getRun(id)!
    const n = { ...cur, ...p }
    db.prepare('UPDATE runs SET status = ?, ended_at = ?, result = ?, cost_usd = ? WHERE id = ?').run(
      n.status, n.endedAt ?? null, n.result ?? null, n.costUsd ?? null, id,
    )
    return n
  },
  getRun(id: string): Run | undefined {
    const r = db.prepare('SELECT * FROM runs WHERE id = ?').get(id) as Row | undefined
    return r && toRun(r)
  },
  listRuns(limit = 200): Run[] {
    return (db.prepare('SELECT * FROM runs ORDER BY started_at DESC LIMIT ?').all(limit) as Row[]).map(toRun).reverse()
  },

  insertOrder(o: Order) {
    db.prepare(
      'INSERT INTO orders (id, run_id, project_id, seq, title, status, external, draft, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(o.id, o.runId, o.projectId, o.seq, o.title, o.status, o.external ? 1 : 0, o.draft ? JSON.stringify(o.draft) : null, o.note ?? null, o.createdAt, o.updatedAt)
  },
  updateOrder(id: string, p: Partial<Order>): Order {
    const cur = repo.getOrder(id)!
    const n = { ...cur, ...p, updatedAt: Date.now() }
    db.prepare('UPDATE orders SET status = ?, draft = ?, note = ?, updated_at = ? WHERE id = ?').run(
      n.status, n.draft ? JSON.stringify(n.draft) : null, n.note ?? null, n.updatedAt, id,
    )
    return n
  },
  getOrder(id: string): Order | undefined {
    const r = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Row | undefined
    return r && toOrder(r)
  },
  ordersOfRun(runId: string): Order[] {
    return (db.prepare('SELECT * FROM orders WHERE run_id = ? ORDER BY seq').all(runId) as Row[]).map(toOrder)
  },
  listOrders(runIds: string[]): Order[] {
    if (!runIds.length) return []
    const q = `SELECT * FROM orders WHERE run_id IN (${runIds.map(() => '?').join(',')}) ORDER BY created_at, seq`
    return (db.prepare(q).all(...runIds) as Row[]).map(toOrder)
  },

  insertLog(l: Omit<LogEntry, 'id'>): LogEntry {
    const res = db
      .prepare('INSERT INTO logs (project_id, run_id, ts, level, text, detail) VALUES (?, ?, ?, ?, ?, ?)')
      .run(l.projectId, l.runId ?? null, l.ts, l.level, l.text, l.detail ?? null)
    return { ...l, id: String(res.lastInsertRowid) }
  },
  listLogs(limit = 1500): LogEntry[] {
    return (db.prepare('SELECT * FROM logs ORDER BY id DESC LIMIT ?').all(limit) as Row[]).map(toLog).reverse()
  },

  /** Al arrancar: lo que quedó a medias en una ejecución anterior ya no tiene proceso detrás. */
  failInterrupted(): number {
    const now = Date.now()
    const runs = db.prepare("SELECT id FROM runs WHERE status IN ('running', 'waiting')").all() as Row[]
    for (const r of runs) {
      db.prepare("UPDATE runs SET status = 'failed', ended_at = ? WHERE id = ?").run(now, r.id as string)
      db.prepare(
        "UPDATE orders SET status = 'failed', note = 'El servidor se reinició', updated_at = ? WHERE run_id = ? AND status IN ('pending', 'running', 'awaiting_approval')",
      ).run(now, r.id as string)
    }
    return runs.length
  },
}
