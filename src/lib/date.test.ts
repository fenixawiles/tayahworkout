import { describe, expect, it } from 'vitest'
import type { DayExercise, DayPlan } from '../types'
import { canEditDate, dateKey, monthGrid, planState, progressForMonth, zonedDateKey } from './date'

function item(id: string, completed = false): DayExercise {
  return {
    id,
    sourceExerciseId: null,
    name: `Exercise ${id}`,
    category: 'strength',
    bodyArea: 'full-body',
    imagePath: null,
    imageUrl: null,
    target: '3 × 10',
    notes: '',
    sortOrder: Number(id.replace(/\D/g, '')) || 0,
    completedAt: completed ? '2026-09-03T14:00:00.000Z' : null,
  }
}

function plan(date: string, exercises: DayExercise[]): DayPlan {
  return { id: date, date, title: 'Workout', reflection: '', exercises }
}

describe('monthly progress', () => {
  it('includes future exercises immediately in the denominator', () => {
    const existing = plan('2026-09-03', Array.from({ length: 90 }, (_, index) => item(String(index), index < 30)))
    expect(progressForMonth([existing], new Date(2026, 8, 1))).toEqual({ completed: 30, total: 90 })

    const future = plan('2026-09-20', [item('future-1'), item('future-2')])
    expect(progressForMonth([existing, future], new Date(2026, 8, 1))).toEqual({ completed: 30, total: 92 })
  })

  it('keeps unfinished past work in the total and ignores other months', () => {
    const missed = plan('2026-09-01', [item('1'), item('2', true)])
    const october = plan('2026-10-01', [item('3', true)])
    expect(progressForMonth([missed, october], new Date(2026, 8, 1))).toEqual({ completed: 1, total: 2 })
    expect(canEditDate('2026-09-01', '2026-09-03')).toBe(false)
  })

  it('recalculates after a completed exercise is removed', () => {
    const complete = plan('2026-09-03', [item('1', true), item('2', true), item('3', true)])
    const afterRemoval = { ...complete, exercises: complete.exercises.slice(0, 2) }
    expect(progressForMonth([complete], new Date(2026, 8, 1))).toEqual({ completed: 3, total: 3 })
    expect(progressForMonth([afterRemoval], new Date(2026, 8, 1))).toEqual({ completed: 2, total: 2 })
  })

  it('reopens a completed day when a new exercise is added', () => {
    const complete = plan('2026-09-03', [item('1', true), item('2', true)])
    expect(planState(complete, '2026-09-03')).toBe('complete')
    expect(planState({ ...complete, exercises: [...complete.exercises, item('3')] }, '2026-09-03')).toBe('in-progress')
  })

  it('represents an empty month without a synthetic denominator', () => {
    expect(progressForMonth([], new Date(2026, 8, 1))).toEqual({ completed: 0, total: 0 })
  })
})

describe('calendar and timezone boundaries', () => {
  it('includes leap day in February 2024', () => {
    expect(monthGrid(new Date(2024, 1, 1)).map(dateKey)).toContain('2024-02-29')
  })

  it('uses the profile timezone across spring and fall DST boundaries', () => {
    expect(zonedDateKey(new Date('2026-03-08T05:59:00Z'), 'America/Chicago')).toBe('2026-03-07')
    expect(zonedDateKey(new Date('2026-03-08T06:01:00Z'), 'America/Chicago')).toBe('2026-03-08')
    expect(zonedDateKey(new Date('2026-11-01T04:59:00Z'), 'America/Chicago')).toBe('2026-10-31')
    expect(zonedDateKey(new Date('2026-11-01T05:01:00Z'), 'America/Chicago')).toBe('2026-11-01')
  })

  it('locks dates before the stored local day', () => {
    expect(canEditDate('2026-09-02', '2026-09-03')).toBe(false)
    expect(canEditDate('2026-09-03', '2026-09-03')).toBe(true)
    expect(canEditDate('2026-09-04', '2026-09-03')).toBe(true)
  })
})
