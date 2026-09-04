import type { BodyArea, Exercise, ExerciseCategory } from '../types'

interface SeedSpec {
  id: string
  name: string
  category: ExerciseCategory
  bodyArea: BodyArea
  equipment: string
  target: string
}

export const SEED_SPECS: SeedSpec[] = [
  { id: 'goblet-squat', name: 'Goblet squat', category: 'strength', bodyArea: 'lower-body', equipment: 'Kettlebell', target: '3 × 10' },
  { id: 'romanian-deadlift', name: 'Romanian deadlift', category: 'strength', bodyArea: 'lower-body', equipment: 'Barbell', target: '3 × 10' },
  { id: 'dumbbell-bench-press', name: 'Dumbbell bench press', category: 'strength', bodyArea: 'upper-body', equipment: 'Dumbbells', target: '3 × 10' },
  { id: 'one-arm-dumbbell-row', name: 'One-arm dumbbell row', category: 'strength', bodyArea: 'upper-body', equipment: 'Dumbbell', target: '3 × 12' },
  { id: 'seated-dumbbell-press', name: 'Seated dumbbell press', category: 'strength', bodyArea: 'upper-body', equipment: 'Dumbbells', target: '3 × 10' },
  { id: 'dumbbell-rear-lunge', name: 'Dumbbell reverse lunge', category: 'strength', bodyArea: 'lower-body', equipment: 'Dumbbells', target: '3 × 8 each' },
  { id: 'barbell-hip-thrust', name: 'Hip thrust', category: 'strength', bodyArea: 'lower-body', equipment: 'Barbell', target: '3 × 12' },
  { id: 'dumbbell-bicep-curl', name: 'Dumbbell curl', category: 'strength', bodyArea: 'upper-body', equipment: 'Dumbbells', target: '3 × 12' },
  { id: 'dumbbell-triceps-extension', name: 'Triceps extension', category: 'strength', bodyArea: 'upper-body', equipment: 'Dumbbell', target: '3 × 12' },
  { id: 'standing-calf-raise', name: 'Standing calf raise', category: 'strength', bodyArea: 'lower-body', equipment: 'Bodyweight', target: '3 × 15' },
  { id: 'bodyweight-squat', name: 'Bodyweight squat', category: 'bodyweight', bodyArea: 'lower-body', equipment: 'None', target: '3 × 15' },
  { id: 'incline-push-up', name: 'Incline push-up', category: 'bodyweight', bodyArea: 'upper-body', equipment: 'Bench', target: '3 × 10' },
  { id: 'glute-bridge', name: 'Glute bridge', category: 'bodyweight', bodyArea: 'lower-body', equipment: 'None', target: '3 × 15' },
  { id: 'dead-bug', name: 'Dead bug', category: 'bodyweight', bodyArea: 'core', equipment: 'None', target: '3 × 8 each' },
  { id: 'plank', name: 'Plank', category: 'bodyweight', bodyArea: 'core', equipment: 'None', target: '3 × 30 sec' },
  { id: 'mountain-climbers', name: 'Mountain climbers', category: 'bodyweight', bodyArea: 'full-body', equipment: 'None', target: '3 × 30 sec' },
  { id: 'air-bike', name: 'Air bike', category: 'cardio', bodyArea: 'full-body', equipment: 'None', target: '3 × 30 sec' },
  { id: 'stationary-bike', name: 'Stationary bike', category: 'cardio', bodyArea: 'lower-body', equipment: 'Bike', target: '20 minutes' },
  { id: 'rope-jumping', name: 'Jump rope', category: 'cardio', bodyArea: 'full-body', equipment: 'Jump rope', target: '10 minutes' },
  { id: 'jogging-treadmill', name: 'Treadmill jog', category: 'cardio', bodyArea: 'lower-body', equipment: 'Treadmill', target: '20 minutes' },
  { id: 'hamstring-stretch', name: 'Hamstring stretch', category: 'mobility', bodyArea: 'lower-body', equipment: 'None', target: '45 sec each' },
  { id: 'kneeling-hip-flexor', name: 'Kneeling hip flexor stretch', category: 'mobility', bodyArea: 'lower-body', equipment: 'None', target: '45 sec each' },
  { id: 'cat-stretch', name: 'Cat stretch', category: 'mobility', bodyArea: 'full-body', equipment: 'None', target: '8 slow reps' },
  { id: 'childs-pose', name: "Child’s pose", category: 'recovery', bodyArea: 'full-body', equipment: 'None', target: '2 minutes' },
]

export function seedExercises(): Exercise[] {
  return SEED_SPECS.map((item) => ({
    id: item.id,
    ownerId: null,
    name: item.name,
    category: item.category,
    bodyArea: item.bodyArea,
    equipment: item.equipment,
    defaultTarget: item.target,
    imagePath: `seed/${item.id}.jpg`,
    imageUrl: `${import.meta.env.BASE_URL}exercises/${item.id}.jpg`,
    isFavorite: false,
  }))
}
