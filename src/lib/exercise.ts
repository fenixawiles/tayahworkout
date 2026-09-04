import type { BodyArea } from '../types'

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
