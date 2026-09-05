export type ExerciseCategory = 'strength' | 'bodyweight' | 'cardio' | 'mobility' | 'recovery'
export type BodyArea = 'upper-body' | 'lower-body' | 'core' | 'full-body'
export type WeightUnit = 'lb' | 'kg'

export interface ExerciseSettings {
  target: string
  weight: number | null
  weightUnit: WeightUnit
}

export interface Profile {
  id: string
  displayName: string
  timeZone: string
  username?: string | null
  friendCode?: string
  usernameChangedAt?: string | null
  timezoneChangedAt?: string | null
}

export interface Exercise {
  id: string
  ownerId: string | null
  name: string
  category: ExerciseCategory
  bodyArea: BodyArea
  equipment: string
  defaultTarget: string
  defaultWeight?: number | null
  defaultWeightUnit?: WeightUnit
  imagePath: string | null
  imageUrl: string | null
  isFavorite: boolean
  isCustom?: boolean
}

export interface DayExercise {
  id: string
  sourceExerciseId: string | null
  name: string
  category: ExerciseCategory
  bodyArea: BodyArea
  imagePath: string | null
  imageUrl: string | null
  target: string
  notes: string
  sortOrder: number
  completedAt: string | null
}

export interface DayPlan {
  id: string
  date: string
  title: string
  reflection: string
  exercises: DayExercise[]
}

export interface RoutineTemplate {
  id: string
  name: string
  exercises: Omit<DayExercise, 'id' | 'completedAt'>[]
}

export interface AppData {
  profile: Profile
  exercises: Exercise[]
  plans: DayPlan[]
  templates: RoutineTemplate[]
}

export interface DayDraft {
  date: string
  title: string
  exercises: DayExercise[]
}
