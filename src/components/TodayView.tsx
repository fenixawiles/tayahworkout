import { Check, ChevronRight, Pencil, Sparkles } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useEffect, useState } from 'react'
import type { DayExercise, DayPlan } from '../types'
import { greetingFor } from '../lib/date'
import { ExerciseCard } from './ExerciseCard'
import { ProgressCard } from './ProgressCard'

interface TodayViewProps {
  displayName: string
  today: string
  plan?: DayPlan
  completed: number
  total: number
  offline: boolean
  onProfile: () => void
  onEdit: () => void
  onToggle: (exercise: DayExercise) => Promise<void>
  onSaveReflection: (reflection: string) => Promise<void>
}

export function TodayView({ displayName, today, plan, completed, total, offline, onProfile, onEdit, onToggle, onSaveReflection }: TodayViewProps) {
  const [reflection, setReflection] = useState(plan?.reflection ?? '')
  const [reflectionStatus, setReflectionStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const isComplete = Boolean(plan?.exercises.length && plan.exercises.every((exercise) => exercise.completedAt))

  useEffect(() => setReflection(plan?.reflection ?? ''), [plan?.reflection])

  async function saveReflection() {
    setReflectionStatus('saving')
    try {
      await onSaveReflection(reflection)
      setReflectionStatus('saved')
    } catch {
      setReflectionStatus('error')
    }
  }

  return (
    <section className="view-section today-view">
      <header className="topbar">
        <div>
          <p className="eyebrow">{format(parseISO(today), 'EEEE, MMM d').toUpperCase()}</p>
          <h1>{greetingFor()}, {displayName}</h1>
        </div>
        <button className="avatar-button" aria-label="Open profile" onClick={onProfile}>{displayName.slice(0, 1).toUpperCase()}</button>
      </header>

      <ProgressCard monthLabel={format(parseISO(today), 'MMMM')} completed={completed} total={total} />

      <section className="today-section" aria-labelledby="today-plan-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">TODAY’S PLAN</p>
            <h2 id="today-plan-title">{plan?.title || 'Nothing planned yet'}</h2>
          </div>
          {plan && <button className="text-button" onClick={onEdit}><Pencil aria-hidden="true" /> Edit</button>}
        </div>

        {plan?.exercises.length ? (
          <div className="exercise-list">
            {plan.exercises.map((exercise) => (
              <ExerciseCard key={exercise.id} exercise={exercise} canComplete offline={offline} onToggle={onToggle} />
            ))}
          </div>
        ) : (
          <div className="empty-card calm"><Sparkles /><h2>Make today yours</h2><p>Add a few exercises whenever you’re ready.</p></div>
        )}

        <button className="primary-button" onClick={onEdit} disabled={offline}>
          {plan ? 'Edit today’s workout' : 'Plan today'} <ChevronRight aria-hidden="true" />
        </button>
      </section>

      {isComplete && (
        <section className="reflection-card celebration" aria-labelledby="reflection-title">
          <div className="celebration-mark"><Check aria-hidden="true" /></div>
          <p className="eyebrow">DAY COMPLETE</p>
          <h2 id="reflection-title">What went well today?</h2>
          <textarea value={reflection} onChange={(event) => { setReflection(event.target.value); setReflectionStatus('idle') }} maxLength={1000} placeholder="A small win, a strong moment, anything you want to remember…" />
          <div className="reflection-actions">
            <span aria-live="polite">{reflectionStatus === 'saving' ? 'Saving…' : reflectionStatus === 'saved' ? 'Saved' : reflectionStatus === 'error' ? 'Couldn’t save' : ''}</span>
            <button className="secondary-button" onClick={saveReflection} disabled={offline || reflectionStatus === 'saving' || reflection === (plan?.reflection ?? '')}>Save reflection</button>
          </div>
        </section>
      )}
    </section>
  )
}
