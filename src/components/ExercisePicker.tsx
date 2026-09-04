import * as Dialog from '@radix-ui/react-dialog'
import { Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Exercise } from '../types'
import { bodyAreaLabel, bodyAreaLabels } from '../lib/exercise'
import { ExerciseThumb } from './ExerciseThumb'

interface ExercisePickerProps {
  open: boolean
  exercises: Exercise[]
  onOpenChange: (open: boolean) => void
  onPick: (exercise: Exercise) => void
}

export function ExercisePicker({ open, exercises, onOpenChange, onPick }: ExercisePickerProps) {
  const [search, setSearch] = useState('')
  const [focus, setFocus] = useState<Exercise['bodyArea'] | 'all'>('all')
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    return [...exercises]
      .filter((exercise) => (focus === 'all' || exercise.bodyArea === focus) && (!query || `${exercise.name} ${exercise.equipment} ${exercise.category} ${bodyAreaLabel(exercise.bodyArea)}`.toLowerCase().includes(query)))
      .sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite) || a.name.localeCompare(b.name))
  }, [exercises, focus, search])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="bottom-sheet" aria-describedby={undefined}>
          <div className="sheet-handle" aria-hidden="true" />
          <div className="sheet-heading">
            <Dialog.Title>Add an exercise</Dialog.Title>
            <Dialog.Close className="icon-button"><X /><span className="sr-only">Close</span></Dialog.Close>
          </div>
          <label className="search-field">
            <Search aria-hidden="true" />
            <span className="sr-only">Search exercises</span>
            <input autoFocus type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search the library" />
          </label>
          <div className="picker-focus" aria-label="Filter by focus tag">
            <button className={focus === 'all' ? 'active' : ''} onClick={() => setFocus('all')}>All</button>
            {Object.entries(bodyAreaLabels).map(([value, label]) => <button key={value} className={focus === value ? 'active' : ''} onClick={() => setFocus(value as Exercise['bodyArea'])}>{label}</button>)}
          </div>
          <div className="picker-list">
            {visible.map((exercise) => (
              <button key={exercise.id} className="picker-row" onClick={() => { onPick(exercise); onOpenChange(false) }}>
                <ExerciseThumb src={exercise.imageUrl} name={exercise.name} category={exercise.category} />
                <span className="exercise-copy"><strong>{exercise.name}</strong><span>{exercise.defaultTarget} · {bodyAreaLabel(exercise.bodyArea)}</span></span>
              </button>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
