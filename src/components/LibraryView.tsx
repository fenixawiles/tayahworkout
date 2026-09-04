import { Archive, Heart, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { BodyArea, Exercise, ExerciseCategory } from '../types'
import { bodyAreaLabel } from '../lib/exercise'
import { ExerciseThumb } from './ExerciseThumb'

type Filter = 'all' | 'favorites' | ExerciseCategory | BodyArea

interface LibraryViewProps {
  exercises: Exercise[]
  offline: boolean
  onToggleFavorite: (exercise: Exercise) => void
  onArchive: (exercise: Exercise) => void
  onCreateCustom: () => void
}

const filters: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'favorites', label: 'Favorites' },
  { value: 'upper-body', label: 'Upper body' },
  { value: 'lower-body', label: 'Lower body' },
  { value: 'core', label: 'Core' },
  { value: 'full-body', label: 'Full body' },
  { value: 'strength', label: 'Strength' },
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'mobility', label: 'Mobility' },
  { value: 'recovery', label: 'Recovery' },
]

export function LibraryView({ exercises, offline, onToggleFavorite, onArchive, onCreateCustom }: LibraryViewProps) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    return exercises.filter((exercise) => {
      const matchesQuery = !query || `${exercise.name} ${exercise.equipment} ${exercise.category} ${bodyAreaLabel(exercise.bodyArea)}`.toLowerCase().includes(query)
      const matchesFilter = filter === 'all' || filter === 'favorites'
        ? filter !== 'favorites' || exercise.isFavorite
        : exercise.category === filter || exercise.bodyArea === filter
      return matchesQuery && matchesFilter
    })
  }, [exercises, filter, search])

  return (
    <section className="view-section library-view" aria-labelledby="library-title">
      <div className="library-heading">
        <div>
          <p className="eyebrow">MOVE YOUR WAY</p>
          <h1 id="library-title">Exercise library</h1>
        </div>
        <button className="round-primary" aria-label="Create custom exercise" onClick={onCreateCustom} disabled={offline}><Plus /></button>
      </div>

      <label className="search-field">
        <Search aria-hidden="true" />
        <span className="sr-only">Search exercises</span>
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search exercises" />
      </label>

      <div className="filter-scroller" aria-label="Filter exercises">
        {filters.map((item) => (
          <button key={item.value} className={filter === item.value ? 'active' : ''} onClick={() => setFilter(item.value)}>{item.label}</button>
        ))}
      </div>

      <div className="library-list">
        {visible.map((exercise) => (
          <article className="library-card" key={exercise.id}>
            <ExerciseThumb src={exercise.imageUrl} name={exercise.name} category={exercise.category} />
            <div className="exercise-copy">
              <strong>{exercise.name}</strong>
              <span>{exercise.defaultTarget} · {bodyAreaLabel(exercise.bodyArea)}</span>
            </div>
            <div className="library-card-actions">
              <button
                className={`favorite-button ${exercise.isFavorite ? 'active' : ''}`}
                aria-label={exercise.isFavorite ? `Remove ${exercise.name} from favorites` : `Add ${exercise.name} to favorites`}
                aria-pressed={exercise.isFavorite}
                disabled={offline}
                onClick={() => onToggleFavorite(exercise)}
              >
                <Heart aria-hidden="true" />
              </button>
              {exercise.isCustom && <button className="archive-button" aria-label={`Archive ${exercise.name}`} disabled={offline} onClick={() => { if (window.confirm(`Archive ${exercise.name}? Saved workout history will keep its snapshot.`)) onArchive(exercise) }}><Archive aria-hidden="true" /></button>}
            </div>
          </article>
        ))}
        {visible.length === 0 && <div className="empty-card"><Search /><h2>No exercises found</h2><p>Try a different search or filter.</p></div>}
      </div>
      <p className="library-credit">Exercise imagery adapted from Free Exercise DB, released to the public domain.</p>
    </section>
  )
}
