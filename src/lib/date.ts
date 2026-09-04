import { addDays, addMonths, endOfMonth, format, isAfter, isBefore, isSameDay, parseISO, startOfMonth, startOfWeek } from 'date-fns'
import type { DayPlan } from '../types'

export function dateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function zonedDateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

export function greetingFor(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function monthGrid(month: Date): Date[] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 })
  return Array.from({ length: 42 }, (_, index) => addDays(start, index))
}

export function monthBounds(month: Date) {
  return { start: dateKey(startOfMonth(month)), end: dateKey(endOfMonth(month)) }
}

export function relativeDayStatus(date: string, today: string): 'past' | 'today' | 'future' {
  const parsed = parseISO(date)
  const todayParsed = parseISO(today)
  if (isSameDay(parsed, todayParsed)) return 'today'
  if (isBefore(parsed, todayParsed)) return 'past'
  return 'future'
}

export function planState(plan: DayPlan | undefined, today: string): 'unplanned' | 'upcoming' | 'today' | 'complete' | 'missed' | 'in-progress' {
  if (!plan || plan.exercises.length === 0) return 'unplanned'
  const complete = plan.exercises.every((item) => Boolean(item.completedAt))
  if (complete) return 'complete'
  const status = relativeDayStatus(plan.date, today)
  if (status === 'past') return 'missed'
  if (status === 'future') return 'upcoming'
  return plan.exercises.some((item) => item.completedAt) ? 'in-progress' : 'today'
}

export function progressForMonth(plans: DayPlan[], month: Date) {
  const { start, end } = monthBounds(month)
  const items = plans
    .filter((plan) => plan.date >= start && plan.date <= end)
    .flatMap((plan) => plan.exercises)
  return {
    completed: items.filter((item) => Boolean(item.completedAt)).length,
    total: items.length,
  }
}

export function shiftMonth(month: Date, amount: number): Date {
  return addMonths(month, amount)
}

export function canEditDate(date: string, today: string): boolean {
  return !isBefore(parseISO(date), parseISO(today))
}

export function isDateAfter(date: string, other: string): boolean {
  return isAfter(parseISO(date), parseISO(other))
}
