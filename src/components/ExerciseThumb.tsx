import { Bike, Dumbbell, HeartPulse, PersonStanding, Sparkles } from 'lucide-react'
import type { ExerciseCategory } from '../types'

interface ExerciseThumbProps {
  src: string | null
  name: string
  category: ExerciseCategory
  size?: 'small' | 'large'
}

const icons = {
  strength: Dumbbell,
  bodyweight: PersonStanding,
  cardio: Bike,
  mobility: Sparkles,
  recovery: HeartPulse,
}

export function ExerciseThumb({ src, name: _name, category, size = 'small' }: ExerciseThumbProps) {
  const Icon = icons[category]
  return (
    <span className={`exercise-thumb category-${category} ${size}`}>
      {src ? <img src={src} alt="" loading="lazy" /> : <Icon aria-hidden="true" />}
    </span>
  )
}
