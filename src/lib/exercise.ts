import type { BodyArea, Exercise, ExerciseSettings } from '../types'

export function exerciseTarget(exercise: Pick<Exercise, 'defaultTarget' | 'defaultWeight' | 'defaultWeightUnit'>): string {
  return [exercise.defaultTarget, exercise.defaultWeight != null ? `${exercise.defaultWeight} ${exercise.defaultWeightUnit ?? 'lb'}` : ''].filter(Boolean).join(' · ')
}

export function validateExerciseSettings(settings: ExerciseSettings): string | null {
  if (settings.target.length > 80) return 'Keep sets, reps, or duration under 80 characters.'
  if (settings.weight !== null && (!Number.isFinite(settings.weight) || settings.weight <= 0 || settings.weight > 10000)) return 'Enter a weight greater than 0 and no more than 10,000, or leave it blank.'
  if (!['lb', 'kg'].includes(settings.weightUnit)) return 'Choose lb or kg.'
  return null
}

export const bodyAreaLabels: Record<BodyArea, string> = {
  'upper-body': 'Upper body',
  'lower-body': 'Lower body',
  core: 'Core',
  'full-body': 'Full body',
}

export function bodyAreaLabel(value: BodyArea): string {
  return bodyAreaLabels[value]
}

export function validateExerciseImage(file: File | null): string | null {
  if (!file) return null
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Choose a JPEG, PNG, or WebP image.'
  if (file.size > 10 * 1024 * 1024) return 'Choose an image smaller than 10 MB.'
  return null
}
