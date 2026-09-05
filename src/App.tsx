import { useCallback, useEffect, useState } from 'react'
import { Activity, CalendarDays, House, Library, WifiOff } from 'lucide-react'
import type { Session, User } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { AuthScreen } from './components/AuthScreen'
import { CalendarView } from './components/CalendarView'
import { CustomExerciseDialog } from './components/CustomExerciseDialog'
import { DayPanel } from './components/DayPanel'
import { LibraryView } from './components/LibraryView'
import { ExerciseDetail } from './components/ExerciseDetail'
import { ProfileDialog } from './components/ProfileDialog'
import { TodayView } from './components/TodayView'
import { canEditDate, dateKey, progressForMonth, zonedDateKey } from './lib/date'
import { addDemoExercise, archiveDemoExercise, loadDemoData, saveDemoData, saveDemoPlan, saveDemoTemplate, updateDemoProfile } from './lib/demoStore'
import { archiveRemoteExercise, createRemoteExercise, loadCachedRemoteData, loadRemoteData, saveRemoteDayPlan, saveRemoteExerciseSettings, saveRemoteReflection, saveRemoteTemplate, setRemoteCompletion, toggleRemoteFavorite, updateRemoteProfile } from './lib/repository'
import { exerciseTarget, validateExerciseSettings } from './lib/exercise'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { AppData, BodyArea, DayDraft, DayExercise, Exercise, ExerciseCategory, ExerciseSettings, Profile } from './types'

type View = 'today' | 'calendar' | 'library'
type Overlay = 'day' | 'profile' | 'custom' | 'exercise' | null

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  return online
}

function viewFromUrl(): View {
  const value = new URLSearchParams(window.location.search).get('view')
  return value === 'calendar' || value === 'library' ? value : 'today'
}

function dateFromUrl(): string | null {
  const value = new URLSearchParams(window.location.search).get('date')
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

async function fileToDataUrl(file: File | null): Promise<string | null> {
  if (!file) return null
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

interface MomentumAppProps {
  user: User | null
  isDemo: boolean
  onSignOut: () => void
}

function MomentumApp({ user, isDemo, onSignOut }: MomentumAppProps) {
  const queryClient = useQueryClient()
  const [data, setData] = useState<AppData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [view, setView] = useState<View>(viewFromUrl)
  const [month, setMonth] = useState(new Date())
  const [overlay, setOverlay] = useState<Overlay>(dateFromUrl() ? 'day' : null)
  const [selectedDate, setSelectedDate] = useState(dateFromUrl() ?? dateKey(new Date()))
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null)
  const [startEditing, setStartEditing] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [engaged, setEngaged] = useState(localStorage.getItem('momentum-engaged') === '1')
  const online = useOnline()

  const reload = useCallback(async () => {
    setLoadError('')
    try {
      const next = isDemo ? loadDemoData() : await loadRemoteData(user!)
      queryClient.setQueryData(['momentum', isDemo ? 'demo' : user!.id], next)
      setData(next)
    } catch (caught) {
      const cached = !isDemo && user ? loadCachedRemoteData(user.id) : null
      if (cached) setData(cached)
      else setLoadError(caught instanceof Error ? caught.message : 'Momentum could not load your workouts.')
    } finally {
      setLoading(false)
    }
  }, [isDemo, queryClient, user])

  useEffect(() => { void reload() }, [reload])

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  useEffect(() => {
    if (dateFromUrl() && !window.history.state?.momentumOverlay) {
      const dayUrl = new URL(window.location.href)
      const rootUrl = new URL(window.location.href)
      rootUrl.searchParams.delete('date')
      window.history.replaceState({}, '', rootUrl)
      window.history.pushState({ momentumOverlay: 'day' }, '', dayUrl)
    }
    const onPopState = (event: PopStateEvent) => {
      setOverlay((event.state?.momentumOverlay as Overlay) ?? null)
      const nextDate = dateFromUrl()
      if (nextDate) setSelectedDate(nextDate)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  function navigate(next: View) {
    const url = new URL(window.location.href)
    if (next === 'today') url.searchParams.delete('view')
    else url.searchParams.set('view', next)
    window.history.replaceState(window.history.state, '', url)
    setView(next)
  }

  function openOverlay(next: Exclude<Overlay, null>, date?: string, editing = false) {
    if (date) setSelectedDate(date)
    setStartEditing(editing)
    const url = new URL(window.location.href)
    if (date) url.searchParams.set('date', date)
    else url.searchParams.delete('date')
    window.history.pushState({ ...(window.history.state ?? {}), momentumOverlay: next }, '', url)
    setOverlay(next)
  }

  function closeOverlay() {
    if (window.history.state?.momentumOverlay) window.history.back()
    else setOverlay(null)
  }

  const markEngaged = useCallback(() => {
    localStorage.setItem('momentum-engaged', '1')
    setEngaged(true)
  }, [])

  const savePlan = useCallback(async (draft: DayDraft) => {
    if (isDemo) setData((current) => current ? saveDemoPlan(current, draft) : current)
    else { await saveRemoteDayPlan(draft); await reload() }
    markEngaged()
  }, [isDemo, markEngaged, reload])

  async function toggleCompletion(exercise: DayExercise) {
    if (!data || !online) return
    const nextCompletedAt = exercise.completedAt ? null : new Date().toISOString()
    const previous = data
    const optimistic = {
      ...data,
      plans: data.plans.map((plan) => ({
        ...plan,
        exercises: plan.exercises.map((item) => item.id === exercise.id ? { ...item, completedAt: nextCompletedAt } : item),
      })),
    }
    setData(optimistic)
    try {
      if (isDemo) saveDemoData(optimistic)
      else await setRemoteCompletion(exercise.id, !exercise.completedAt)
      markEngaged()
    } catch (caught) {
      setData(previous)
      throw caught
    }
  }

  async function saveReflection(reflection: string) {
    if (!data) return
    const today = zonedDateKey(new Date(), data.profile.timeZone)
    if (isDemo) {
      const next = { ...data, plans: data.plans.map((plan) => plan.date === today ? { ...plan, reflection } : plan) }
      setData(next)
      saveDemoData(next)
    } else {
      await saveRemoteReflection(today, reflection)
      await reload()
    }
  }

  async function toggleFavorite(exercise: Exercise) {
    if (!data) return
    const next = { ...data, exercises: data.exercises.map((item) => item.id === exercise.id ? { ...item, isFavorite: !item.isFavorite } : item) }
    setData(next)
    try {
      if (isDemo) saveDemoData(next)
      else await toggleRemoteFavorite(user!.id, exercise.id, !exercise.isFavorite)
    } catch (caught) {
      setData(data)
      throw caught
    }
  }

  async function createExercise(input: { name: string; category: ExerciseCategory; bodyArea: BodyArea; equipment: string; target: string; file: File | null }) {
    if (!data) return
    if (isDemo) {
      const url = await fileToDataUrl(input.file)
      const custom: Exercise = { id: crypto.randomUUID(), ownerId: data.profile.id, name: input.name, category: input.category, bodyArea: input.bodyArea, equipment: input.equipment, defaultTarget: input.target, imagePath: null, imageUrl: url, isFavorite: false, isCustom: true }
      setData(addDemoExercise(data, custom))
    } else {
      await createRemoteExercise(user!.id, input)
      await reload()
    }
  }

  async function archiveExercise(exercise: Exercise) {
    if (!data || !exercise.isCustom) return
    if (isDemo) setData(archiveDemoExercise(data, exercise.id))
    else { await archiveRemoteExercise(exercise.id); await reload() }
  }

  async function saveExerciseSettings(exercise: Exercise, settings: ExerciseSettings) {
    if (!data || !navigator.onLine) throw new Error('Reconnect to save your exercise.')
    const invalid = validateExerciseSettings(settings)
    if (invalid) throw new Error(invalid)
    if (!isDemo) await saveRemoteExerciseSettings(user!.id, exercise.id, settings)
    const next = { ...data, exercises: data.exercises.map((item) => item.id === exercise.id ? {
      ...item, defaultTarget: settings.target, defaultWeight: settings.weight, defaultWeightUnit: settings.weightUnit,
    } : item) }
    if (isDemo) saveDemoData(next)
    else localStorage.setItem(`momentum-remote-cache-${user!.id}`, JSON.stringify(next))
    setData(next)
  }

  async function saveTemplate(name: string, plan: AppData['plans'][number]) {
    if (!data) return
    if (isDemo) setData(saveDemoTemplate(data, name, plan))
    else { await saveRemoteTemplate(name, plan); await reload() }
  }

  async function saveProfile(profile: Profile) {
    if (!data) return
    if (isDemo) setData(updateDemoProfile(data, profile))
    else { await updateRemoteProfile(profile); await reload() }
  }

  async function install() {
    if (!installPrompt) return
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') setInstallPrompt(null)
  }

  const today = data ? zonedDateKey(new Date(), data.profile.timeZone) : dateKey(new Date())
  const todayPlan = data?.plans.find((plan) => plan.date === today)
  const currentProgress = data ? progressForMonth(data.plans, new Date(`${today}T12:00:00`)) : { completed: 0, total: 0 }
  const selectedPlan = data?.plans.find((plan) => plan.date === selectedDate)
  const selectedExercise = data?.exercises.find((exercise) => exercise.id === selectedExerciseId)

  useEffect(() => {
    const context = document.modelContext
    if (!context?.registerTool || !data) return
    const lifecycle = new AbortController()
    const report = (error: unknown) => console.warn('WebMCP tool registration failed', error)

    void Promise.resolve(context.registerTool({
      name: 'get_month_progress',
      title: 'Get month progress',
      description: 'Read the signed-in user’s current monthly exercise progress.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute() {
        return { month: today.slice(0, 7), completed: currentProgress.completed, total: currentProgress.total }
      },
    }, { signal: lifecycle.signal })).catch(report)

    void Promise.resolve(context.registerTool({
      name: 'plan_workout_day',
      title: 'Plan workout day',
      description: 'Create or replace a current or future workout day using exercise IDs from the visible library.',
      inputSchema: {
        type: 'object',
        properties: {
          date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          title: { type: 'string', minLength: 1, maxLength: 100 },
          exerciseIds: { type: 'array', minItems: 1, items: { type: 'string' } },
        },
        required: ['date', 'title', 'exerciseIds'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        const value = input as { date?: unknown; title?: unknown; exerciseIds?: unknown }
        if (typeof value.date !== 'string' || typeof value.title !== 'string' || !Array.isArray(value.exerciseIds) || !value.exerciseIds.every((id) => typeof id === 'string')) throw new Error('Invalid workout plan input.')
        if (!canEditDate(value.date, today)) throw new Error('Past workout days are read-only.')
        const selected = value.exerciseIds.map((id) => data.exercises.find((exercise) => exercise.id === id))
        if (selected.some((exercise) => !exercise)) throw new Error('One or more exercise IDs were not found.')
        await savePlan({
          date: value.date,
          title: value.title,
          exercises: selected.map((exercise, index) => ({
            id: crypto.randomUUID(),
            sourceExerciseId: exercise!.id,
            name: exercise!.name,
            category: exercise!.category,
            bodyArea: exercise!.bodyArea,
            imagePath: exercise!.imagePath,
            imageUrl: exercise!.imageUrl,
            target: exerciseTarget(exercise!),
            notes: '',
            sortOrder: index,
            completedAt: null,
          })),
        })
        setSelectedDate(value.date)
        return { date: value.date, title: value.title, exerciseCount: selected.length, status: 'saved' }
      },
    }, { signal: lifecycle.signal })).catch(report)

    return () => lifecycle.abort()
  }, [currentProgress.completed, currentProgress.total, data, savePlan, today])

  if (loading) return <main className="center-state"><span className="loading-orb" /><p>Getting your month ready…</p></main>
  if (loadError || !data) return <main className="center-state"><h1>We couldn’t open Momentum</h1><p>{loadError}</p><button className="primary-button" onClick={() => { setLoading(true); void reload() }}>Try again</button></main>

  return (
    <main className="app-frame">
      <div className="app-wordmark"><Activity aria-hidden="true" /><span>momentum</span></div>
      {!online && <div className="offline-banner" role="status"><WifiOff /> You’re offline. Your saved plan is view-only.</div>}

      {view === 'today' && (
        <TodayView
          displayName={data.profile.displayName}
          today={today}
          plan={todayPlan}
          completed={currentProgress.completed}
          total={currentProgress.total}
          offline={!online}
          onProfile={() => openOverlay('profile')}
          onEdit={() => openOverlay('day', today, true)}
          onToggle={toggleCompletion}
          onSaveReflection={saveReflection}
        />
      )}
      {view === 'calendar' && <CalendarView month={month} today={today} plans={data.plans} onMonthChange={setMonth} onSelectDate={(date) => openOverlay('day', date)} />}
      {view === 'library' && <LibraryView exercises={data.exercises} offline={!online} onToggleFavorite={toggleFavorite} onArchive={archiveExercise} onCreateCustom={() => openOverlay('custom')} onOpenExercise={(exercise) => { setSelectedExerciseId(exercise.id); openOverlay('exercise') }} />}

      <nav className="bottom-nav" aria-label="Main navigation">
        <button className={view === 'today' ? 'active' : ''} aria-current={view === 'today' ? 'page' : undefined} onClick={() => navigate('today')}><House aria-hidden="true" /><span>Today</span></button>
        <button className={view === 'calendar' ? 'active' : ''} aria-current={view === 'calendar' ? 'page' : undefined} onClick={() => navigate('calendar')}><CalendarDays aria-hidden="true" /><span>Calendar</span></button>
        <button className={view === 'library' ? 'active' : ''} aria-current={view === 'library' ? 'page' : undefined} onClick={() => navigate('library')}><Library aria-hidden="true" /><span>Library</span></button>
      </nav>

      {overlay === 'day' && (
        <DayPanel
          key={`${selectedDate}-${startEditing ? 'edit' : 'view'}-${selectedPlan?.id ?? 'new'}`}
          open
          date={selectedDate}
          today={today}
          plan={selectedPlan}
          exercises={data.exercises}
          templates={data.templates}
          offline={!online}
          startEditing={startEditing}
          onClose={closeOverlay}
          onSave={savePlan}
          onToggle={toggleCompletion}
          onSaveTemplate={saveTemplate}
        />
      )}
      <ProfileDialog open={overlay === 'profile'} profile={data.profile} canInstall={Boolean(installPrompt && engaged)} isDemo={isDemo} onOpenChange={(open) => { if (!open) closeOverlay() }} onSave={saveProfile} onInstall={install} onSignOut={onSignOut} />
      <CustomExerciseDialog open={overlay === 'custom'} onOpenChange={(open) => { if (!open) closeOverlay() }} onSave={createExercise} />
      {overlay === 'exercise' && selectedExercise && <ExerciseDetail key={selectedExercise.id} exercise={selectedExercise} offline={!online} onClose={closeOverlay} onSave={saveExerciseSettings} />}
    </main>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured)
  const [demo, setDemo] = useState(sessionStorage.getItem('momentum-demo-active') === '1')
  const [recoveryMode, setRecoveryMode] = useState(false)

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthLoading(false) })
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
      setSession(nextSession)
      setAuthLoading(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  if (authLoading) return <main className="center-state"><span className="loading-orb" /><p>Opening Momentum…</p></main>
  if (!session && !demo) {
    return <AuthScreen recoveryMode={recoveryMode} onDemo={() => { sessionStorage.setItem('momentum-demo-active', '1'); setDemo(true) }} onAuthenticated={() => { void supabase?.auth.getSession().then(({ data }) => setSession(data.session)) }} />
  }
  return <MomentumApp user={session?.user ?? null} isDemo={demo} onSignOut={() => {
    if (demo) { sessionStorage.removeItem('momentum-demo-active'); setDemo(false) }
    else void supabase?.auth.signOut()
  }} />
}
