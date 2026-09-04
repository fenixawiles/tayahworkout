import { addDays, format } from 'date-fns'
import { seedExercises } from '../data/seedExercises'
import type { AppData, DayDraft, DayExercise, DayPlan, Exercise, Profile, RoutineTemplate } from '../types'

const STORAGE_KEY = 'momentum-demo-data-v1'

function exerciseItem(exercise: Exercise, index: number, complete = false): DayExercise {
  return {
    id: crypto.randomUUID(),
    sourceExerciseId: exercise.id,
    name: exercise.name,
    category: exercise.category,
    bodyArea: exercise.bodyArea,
    imagePath: exercise.imagePath,
    imageUrl: exercise.imageUrl,
    target: exercise.defaultTarget,
    notes: '',
    sortOrder: index,
    completedAt: complete ? new Date().toISOString() : null,
  }
}

function initialData(): AppData {
  const exercises = seedExercises()
  const now = new Date()
  const today = format(now, 'yyyy-MM-dd')
  const yesterday = format(addDays(now, -1), 'yyyy-MM-dd')
  const tomorrow = format(addDays(now, 1), 'yyyy-MM-dd')
  const plans: DayPlan[] = [
    {
      id: crypto.randomUUID(),
      date: yesterday,
      title: 'Lower body strength',
      reflection: 'I stayed patient with every rep and finished feeling stronger.',
      exercises: [
        exerciseItem(exercises[0], 0, true),
        exerciseItem(exercises[1], 1, true),
        exerciseItem(exercises[12], 2, true),
      ],
    },
    {
      id: crypto.randomUUID(),
      date: today,
      title: 'Full body reset',
      reflection: '',
      exercises: [
        exerciseItem(exercises[0], 0),
        exerciseItem(exercises[3], 1),
        exerciseItem(exercises[21], 2),
      ],
    },
    {
      id: crypto.randomUUID(),
      date: tomorrow,
      title: 'Easy cardio + core',
      reflection: '',
      exercises: [
        exerciseItem(exercises[17], 0),
        exerciseItem(exercises[14], 1),
      ],
    },
  ]
  return {
    profile: { id: 'demo-user', displayName: 'Tayah', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    exercises,
    plans,
    templates: [],
  }
}

export function loadDemoData(): AppData {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (!saved) {
    const data = initialData()
    saveDemoData(data)
    return data
  }
  const parsed = JSON.parse(saved) as AppData
  const seedById = new Map(seedExercises().map((item) => [item.id, item]))
  parsed.exercises = parsed.exercises.map((item) => seedById.get(item.id) ?? { ...item, bodyArea: item.bodyArea ?? 'full-body' })
  parsed.plans = parsed.plans.map((plan) => ({
    ...plan,
    exercises: plan.exercises.map((item) => ({
      ...item,
      bodyArea: item.bodyArea ?? (item.sourceExerciseId ? seedById.get(item.sourceExerciseId)?.bodyArea : undefined) ?? 'full-body',
      imageUrl: item.sourceExerciseId ? seedById.get(item.sourceExerciseId)?.imageUrl ?? item.imageUrl : item.imageUrl,
    })),
  }))
  return parsed
}

export function saveDemoData(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function saveDemoPlan(data: AppData, draft: DayDraft): AppData {
  const plan: DayPlan = {
    id: data.plans.find((item) => item.date === draft.date)?.id ?? crypto.randomUUID(),
    date: draft.date,
    title: draft.title.trim() || 'Workout day',
    reflection: data.plans.find((item) => item.date === draft.date)?.reflection ?? '',
    exercises: draft.exercises.map((item, index) => ({ ...item, sortOrder: index })),
  }
  const next = { ...data, plans: [...data.plans.filter((item) => item.date !== draft.date), plan] }
  saveDemoData(next)
  return next
}

export function saveDemoTemplate(data: AppData, name: string, plan: DayPlan): AppData {
  const template: RoutineTemplate = {
    id: crypto.randomUUID(),
    name,
    exercises: plan.exercises.map(({ id: _id, completedAt: _completedAt, ...item }) => item),
  }
  const next = { ...data, templates: [...data.templates, template] }
  saveDemoData(next)
  return next
}

export function addDemoExercise(data: AppData, exercise: Exercise): AppData {
  const next = { ...data, exercises: [...data.exercises, exercise] }
  saveDemoData(next)
  return next
}

export function archiveDemoExercise(data: AppData, exerciseId: string): AppData {
  const next = { ...data, exercises: data.exercises.filter((exercise) => exercise.id !== exerciseId) }
  saveDemoData(next)
  return next
}

export function updateDemoProfile(data: AppData, profile: Profile): AppData {
  const next = { ...data, profile }
  saveDemoData(next)
  return next
}
