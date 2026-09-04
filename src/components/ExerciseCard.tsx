import { Check, LockKeyhole } from 'lucide-react'
import type { DayExercise } from '../types'
import { bodyAreaLabel } from '../lib/exercise'
import { ExerciseThumb } from './ExerciseThumb'

interface ExerciseCardProps {
  exercise: DayExercise
  canComplete: boolean
  offline?: boolean
  onToggle?: (exercise: DayExercise) => void
}

export function ExerciseCard({ exercise, canComplete, offline, onToggle }: ExerciseCardProps) {
  const completed = Boolean(exercise.completedAt)
  return (
    <article className={`exercise-card ${completed ? 'completed' : ''}`}>
      <ExerciseThumb src={exercise.imageUrl} name={exercise.name} category={exercise.category} />
      <div className="exercise-copy">
        <strong>{exercise.name}</strong>
        <span>{exercise.target || 'No target set'} · {bodyAreaLabel(exercise.bodyArea)}</span>
        {exercise.notes && <small>{exercise.notes}</small>}
      </div>
      <button
        type="button"
        className={`check-button ${completed ? 'checked' : ''}`}
        aria-label={completed ? `Mark ${exercise.name} incomplete` : `Mark ${exercise.name} complete`}
        aria-pressed={completed}
        disabled={!canComplete || offline}
        onClick={() => onToggle?.(exercise)}
      >
        {completed ? <Check aria-hidden="true" /> : !canComplete ? <LockKeyhole aria-hidden="true" /> : null}
      </button>
    </article>
  )
}
