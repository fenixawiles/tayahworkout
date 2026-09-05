import imageCompression from 'browser-image-compression'
import type { User } from '@supabase/supabase-js'
import type { AppData, BodyArea, DayDraft, DayExercise, DayPlan, Exercise, ExerciseCategory, ExerciseSettings, Profile, RoutineTemplate } from '../types'
import { supabase } from './supabase'

const remoteCacheKey = (userId: string) => `momentum-remote-cache-${userId}`

interface ExerciseRow {
  id: string
  owner_id: string | null
  name: string
  category: ExerciseCategory
  body_area: BodyArea
  equipment: string | null
  default_target: string | null
  image_path: string | null
}

interface CompletionRow { completed_at: string }

interface DayExerciseRow {
  id: string
  source_exercise_id: string | null
  name_snapshot: string
  category: ExerciseCategory
  body_area_snapshot: BodyArea
  image_path_snapshot: string | null
  target: string | null
  notes: string | null
  sort_order: number
  exercise_completions?: CompletionRow | null
}

interface DayPlanRow {
  id: string
  plan_date: string
  title: string
  reflection: string | null
  day_exercises?: DayExerciseRow[]
}

interface TemplateItemRow {
  source_exercise_id: string | null
  name_snapshot: string
  category: ExerciseCategory
  body_area_snapshot: BodyArea
  image_path_snapshot: string | null
  target: string | null
  notes: string | null
  sort_order: number
}

interface TemplateRow {
  id: string
  name: string
  routine_template_items?: TemplateItemRow[]
}

async function imageUrl(path: string | null): Promise<string | null> {
  if (!path) return null
  if (path.startsWith('seed/')) {
    return `${import.meta.env.BASE_URL}exercises/${path.slice('seed/'.length)}`
  }
  const { data } = await supabase!.storage.from('exercise-images').createSignedUrl(path, 60 * 60)
  return data?.signedUrl ?? null
}

async function mapDayExercise(row: DayExerciseRow): Promise<DayExercise> {
  return {
    id: row.id,
    sourceExerciseId: row.source_exercise_id,
    name: row.name_snapshot,
    category: row.category,
    bodyArea: row.body_area_snapshot,
    imagePath: row.image_path_snapshot,
    imageUrl: await imageUrl(row.image_path_snapshot),
    target: row.target ?? '',
    notes: row.notes ?? '',
    sortOrder: row.sort_order,
    completedAt: row.exercise_completions?.completed_at ?? null,
  }
}

export async function loadRemoteData(user: User): Promise<AppData> {
  if (!supabase) throw new Error('Supabase is not configured.')

  const [profileResult, exerciseResult, favoriteResult, planResult, templateResult, preferenceResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('exercises').select('*').is('archived_at', null).order('name'),
    supabase.from('exercise_favorites').select('exercise_id').eq('user_id', user.id),
    supabase.from('day_plans').select('*, day_exercises(*, exercise_completions(completed_at))').order('plan_date'),
    supabase.from('routine_templates').select('*, routine_template_items(*)').order('created_at'),
    supabase.from('exercise_preferences').select('*').eq('user_id', user.id),
  ])

  const firstError = [profileResult, exerciseResult, favoriteResult, planResult, templateResult, preferenceResult].find((result) => result.error)?.error
  if (firstError) throw firstError

  const profileRow = profileResult.data
  if (!profileRow) {
    throw new Error('Your account profile could not be loaded. Please contact support before creating another account.')
  }

  const favorites = new Set((favoriteResult.data ?? []).map((item) => item.exercise_id))
  const preferences = new Map((preferenceResult.data ?? []).map((item) => [item.exercise_id, item]))
  const exercises = (await Promise.all(((exerciseResult.data ?? []) as ExerciseRow[]).map(async (row) => ({
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    category: row.category,
    bodyArea: row.body_area,
    equipment: row.equipment ?? 'None',
    defaultTarget: preferences.get(row.id)?.target ?? row.default_target ?? '',
    defaultWeight: preferences.get(row.id)?.weight ?? null,
    defaultWeightUnit: preferences.get(row.id)?.weight_unit ?? 'lb',
    imagePath: row.image_path,
    imageUrl: await imageUrl(row.image_path),
    isFavorite: favorites.has(row.id),
    isCustom: row.owner_id === user.id,
  } satisfies Exercise)))).filter((exercise) => !preferences.get(exercise.id)?.hidden_at)

  const plans = await Promise.all(((planResult.data ?? []) as DayPlanRow[]).map(async (row) => ({
    id: row.id,
    date: row.plan_date,
    title: row.title,
    reflection: row.reflection ?? '',
    exercises: (await Promise.all((row.day_exercises ?? []).map(mapDayExercise))).sort((a, b) => a.sortOrder - b.sortOrder),
  } satisfies DayPlan)))

  const templates = await Promise.all(((templateResult.data ?? []) as TemplateRow[]).map(async (row) => ({
    id: row.id,
    name: row.name,
    exercises: await Promise.all((row.routine_template_items ?? []).sort((a, b) => a.sort_order - b.sort_order).map(async (item) => ({
      sourceExerciseId: item.source_exercise_id,
      name: item.name_snapshot,
      category: item.category,
      bodyArea: item.body_area_snapshot,
      imagePath: item.image_path_snapshot,
      imageUrl: await imageUrl(item.image_path_snapshot),
      target: item.target ?? '',
      notes: item.notes ?? '',
      sortOrder: item.sort_order,
    }))),
  } satisfies RoutineTemplate)))

  const appData = {
    profile: { id: profileRow.id, displayName: profileRow.display_name, timeZone: profileRow.time_zone, username: profileRow.username, friendCode: profileRow.friend_code, usernameChangedAt: profileRow.username_changed_at, timezoneChangedAt: profileRow.timezone_changed_at },
    exercises,
    plans,
    templates,
  }
  localStorage.setItem(remoteCacheKey(user.id), JSON.stringify(appData))
  return appData
}

export function loadCachedRemoteData(userId: string): AppData | null {
  const value = localStorage.getItem(remoteCacheKey(userId))
  if (!value) return null
  try { return JSON.parse(value) as AppData } catch { return null }
}

export async function saveRemoteExerciseSettings(userId: string, exerciseId: string, settings: ExerciseSettings) {
  const { error } = await supabase!.from('exercise_preferences').upsert({
    user_id: userId,
    exercise_id: exerciseId,
    target: settings.target,
    weight: settings.weight,
    weight_unit: settings.weightUnit,
  })
  if (error) throw error
}

export async function saveRemoteDayPlan(draft: DayDraft) {
  const { error } = await supabase!.rpc('save_day_plan', {
    p_plan_date: draft.date,
    p_title: draft.title,
    p_items: draft.exercises.map((item, index) => ({
      id: item.id,
      source_exercise_id: item.sourceExerciseId,
      name: item.name,
      category: item.category,
      body_area: item.bodyArea,
      image_path: item.imagePath,
      target: item.target,
      notes: item.notes,
      sort_order: index,
    })),
  })
  if (error) throw error
}

export async function setRemoteCompletion(dayExerciseId: string, completed: boolean) {
  const { error } = await supabase!.rpc('set_exercise_completion', {
    p_day_exercise_id: dayExerciseId,
    p_completed: completed,
  })
  if (error) throw error
}

export async function saveRemoteReflection(date: string, reflection: string) {
  const { error } = await supabase!.rpc('save_day_reflection', {
    p_plan_date: date,
    p_reflection: reflection,
  })
  if (error) throw error
}

export async function toggleRemoteFavorite(userId: string, exerciseId: string, favorite: boolean) {
  const query = favorite
    ? supabase!.from('exercise_favorites').upsert({ user_id: userId, exercise_id: exerciseId })
    : supabase!.from('exercise_favorites').delete().eq('user_id', userId).eq('exercise_id', exerciseId)
  const { error } = await query
  if (error) throw error
}

export async function createRemoteExercise(userId: string, input: {
  name: string
  category: ExerciseCategory
  bodyArea: BodyArea
  equipment: string
  target: string
  file: File | null
}) {
  let path: string | null = null
  if (input.file) {
    const compressed = await imageCompression(input.file, {
      maxSizeMB: 0.45,
      maxWidthOrHeight: 720,
      useWebWorker: true,
      fileType: 'image/webp',
    })
    path = `${userId}/${crypto.randomUUID()}.webp`
    const upload = await supabase!.storage.from('exercise-images').upload(path, compressed, {
      contentType: 'image/webp',
      cacheControl: '3600',
    })
    if (upload.error) throw upload.error
  }
  const { error } = await supabase!.from('exercises').insert({
    owner_id: userId,
    name: input.name,
    category: input.category,
    body_area: input.bodyArea,
    equipment: input.equipment,
    default_target: input.target,
    image_path: path,
  })
  if (error) throw error
}

export async function archiveRemoteExercise(exerciseId: string) {
  const { error } = await supabase!.rpc('remove_exercise_from_library', { p_exercise_id: exerciseId })
  if (error) throw error
}

export async function saveRemoteTemplate(name: string, plan: DayPlan) {
  const { error } = await supabase!.rpc('save_routine_template', {
    p_name: name,
    p_items: plan.exercises.map((item, index) => ({
      source_exercise_id: item.sourceExerciseId,
      name: item.name,
      category: item.category,
      body_area: item.bodyArea,
      image_path: item.imagePath,
      target: item.target,
      notes: item.notes,
      sort_order: index,
    })),
  })
  if (error) throw error
}

export async function updateRemoteProfile(profile: Profile) {
  const { error } = await supabase!.rpc('update_profile', {
    p_display_name: profile.displayName,
    p_time_zone: profile.timeZone,
    p_username: profile.username ?? '',
  })
  if (error) throw error
}
