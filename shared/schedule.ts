// Reglas de las tareas programadas, compartidas por servidor y web.
import type { ScheduleRule } from './types'

const atTime = (day: Date, time: string): Date => {
  const [hh, mm] = time.split(':').map(Number)
  const d = new Date(day)
  d.setHours(hh, mm, 0, 0)
  return d
}

export function ruleMatchesDay(rule: ScheduleRule, day: Date): boolean {
  switch (rule.type) {
    case 'daily':
      return true
    case 'weekly':
      return rule.weekdays.includes(day.getDay())
    case 'once':
      return new Date(rule.at).toDateString() === day.toDateString()
  }
}

/** Próxima ejecución estrictamente posterior a `from`, o null si ya no habrá más. */
export function nextOccurrence(rule: ScheduleRule, from = new Date()): Date | null {
  if (rule.type === 'once') {
    const d = new Date(rule.at)
    return d > from ? d : null
  }
  for (let i = 0; i < 8; i++) {
    const day = new Date(from)
    day.setDate(day.getDate() + i)
    const d = atTime(day, rule.time)
    if (d > from && ruleMatchesDay(rule, d)) return d
  }
  return null
}

/** ¿Toca ejecutar alguna vez en el intervalo (from, to]? */
export function dueBetween(rule: ScheduleRule, from: Date, to: Date): boolean {
  const next = nextOccurrence(rule, from)
  return !!next && next <= to
}

export function isValidRule(rule: unknown): rule is ScheduleRule {
  const r = rule as ScheduleRule
  const time = (t: unknown) => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t)
  if (!r || typeof r !== 'object') return false
  if (r.type === 'daily') return time(r.time)
  if (r.type === 'weekly')
    return time(r.time) && Array.isArray(r.weekdays) && r.weekdays.length > 0 && r.weekdays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)
  if (r.type === 'once') return typeof r.at === 'string' && !Number.isNaN(new Date(r.at).getTime())
  return false
}
