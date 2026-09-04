import * as AlertDialog from '@radix-ui/react-alert-dialog'
import * as Dialog from '@radix-ui/react-dialog'
import { ArrowDown, ArrowLeft, ArrowUp, CalendarPlus, Check, Copy, MoreHorizontal, Plus, Save, Trash2, X } from 'lucide-react'
import { addDays, format, parseISO } from 'date-fns'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { DayDraft, DayExercise, DayPlan, Exercise, RoutineTemplate } from '../types'
import { canEditDate } from '../lib/date'
import { bodyAreaLabel } from '../lib/exercise'
import { ExerciseCard } from './ExerciseCard'
import { ExercisePicker } from './ExercisePicker'
import { ExerciseThumb } from './ExerciseThumb'

interface DayPanelProps {
  open: boolean
  date: string
  today: string
  plan?: DayPlan
  exercises: Exercise[]
  templates: RoutineTemplate[]
  offline: boolean
  startEditing?: boolean
  onClose: () => void
  onSave: (draft: DayDraft) => Promise<void>
  onToggle: (exercise: DayExercise) => Promise<void>
  onSaveTemplate: (name: string, plan: DayPlan) => Promise<void>
}

function copyItems(items: DayExercise[], preserveIds = true): DayExercise[] {
  return items.map((item, index) => ({ ...item, id: preserveIds ? item.id : crypto.randomUUID(), sortOrder: index, completedAt: preserveIds ? item.completedAt : null }))
}

export function DayPanel({ open, date, today, plan, exercises, templates, offline, startEditing, onClose, onSave, onToggle, onSaveTemplate }: DayPanelProps) {
  const editable = canEditDate(date, today)
  const [mode, setMode] = useState<'detail' | 'edit'>(startEditing || (!plan && editable) ? 'edit' : 'detail')
  const [draft, setDraft] = useState<DayDraft>({ date, title: plan?.title ?? '', exercises: copyItems(plan?.exercises ?? []) })
  const [pickerOpen, setPickerOpen] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [action, setAction] = useState<'none' | 'duplicate' | 'template'>('none')
  const [actionValue, setActionValue] = useState(format(addDays(parseISO(date), 1), 'yyyy-MM-dd'))
  const [actionError, setActionError] = useState('')
  const dirtyGuard = useRef(false)
  const discarding = useRef(false)

  const baseline = useMemo(() => JSON.stringify({ title: plan?.title ?? '', exercises: copyItems(plan?.exercises ?? []).map(({ completedAt: _c, ...item }) => item) }), [plan])
  const current = JSON.stringify({ title: draft.title, exercises: draft.exercises.map(({ completedAt: _c, ...item }) => item) })
  const dirty = current !== baseline
  const complete = Boolean(plan?.exercises.length && plan.exercises.every((item) => item.completedAt))

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const layer = event.state?.momentumLayer
      if (layer !== 'picker') setPickerOpen(false)
      if (layer !== 'action') setAction('none')
      if (dirtyGuard.current && layer !== 'dirty' && mode === 'edit' && dirty) {
        dirtyGuard.current = false
        setConfirmClose(true)
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [dirty, mode])

  useEffect(() => {
    if (mode === 'edit' && dirty && !dirtyGuard.current && !window.history.state?.momentumLayer) {
      window.history.pushState({ ...(window.history.state ?? {}), momentumOverlay: 'day', momentumLayer: 'dirty' }, '')
      dirtyGuard.current = true
    }
  }, [dirty, mode])

  function openLayer(layer: 'picker' | 'action') {
    window.history.pushState({ ...(window.history.state ?? {}), momentumOverlay: 'day', momentumLayer: layer }, '')
  }

  function closeLayer(layer: 'picker' | 'action') {
    if (window.history.state?.momentumLayer === layer) window.history.back()
    else if (layer === 'picker') setPickerOpen(false)
    else setAction('none')
  }

  function requestClose() {
    if (mode === 'edit' && dirty && window.history.state?.momentumLayer === 'dirty') window.history.back()
    else if (mode === 'edit' && dirty) setConfirmClose(true)
    else onClose()
  }

  function keepEditing() {
    setConfirmClose(false)
    if (!dirtyGuard.current) {
      window.history.pushState({ ...(window.history.state ?? {}), momentumOverlay: 'day', momentumLayer: 'dirty' }, '')
      dirtyGuard.current = true
    }
  }

  function discardChanges() {
    discarding.current = true
    dirtyGuard.current = false
    onClose()
  }

  function addExercise(exercise: Exercise) {
    setDraft((value) => ({
      ...value,
      exercises: [...value.exercises, {
        id: crypto.randomUUID(),
        sourceExerciseId: exercise.id,
        name: exercise.name,
        category: exercise.category,
        bodyArea: exercise.bodyArea,
        imagePath: exercise.imagePath,
        imageUrl: exercise.imageUrl,
        target: exercise.defaultTarget,
        notes: '',
        sortOrder: value.exercises.length,
        completedAt: null,
      }],
    }))
    setSaveStatus('idle')
  }

  function move(index: number, direction: -1 | 1) {
    setDraft((value) => {
      const items = [...value.exercises]
      const target = index + direction
      if (target < 0 || target >= items.length) return value
      ;[items[index], items[target]] = [items[target], items[index]]
      return { ...value, exercises: items.map((item, sortOrder) => ({ ...item, sortOrder })) }
    })
  }

  function remove(item: DayExercise) {
    if (item.completedAt && !window.confirm('This exercise is complete. Remove it and update today’s progress?')) return
    setDraft((value) => ({ ...value, exercises: value.exercises.filter((exercise) => exercise.id !== item.id) }))
  }

  async function save() {
    if (draft.exercises.length === 0) { setSaveStatus('error'); return }
    setSaveStatus('saving')
    try {
      await onSave(draft)
      setSaveStatus('saved')
      setMode('detail')
      if (dirtyGuard.current && window.history.state?.momentumLayer === 'dirty') {
        dirtyGuard.current = false
        window.history.back()
      }
    } catch {
      setSaveStatus('error')
    }
  }

  function applyTemplate(template: RoutineTemplate) {
    setDraft((value) => ({
      ...value,
      title: value.title || template.name,
      exercises: template.exercises.map((item, index) => ({ ...item, id: crypto.randomUUID(), completedAt: null, sortOrder: index })),
    }))
  }

  async function runAction() {
    setActionError('')
    try {
      if (action === 'duplicate' && plan) {
        if (!canEditDate(actionValue, today)) throw new Error('Choose today or a future date.')
        await onSave({ date: actionValue, title: plan.title, exercises: copyItems(plan.exercises, false) })
      } else if (action === 'template' && plan) {
        if (!actionValue.trim()) throw new Error('Give this routine a name.')
        await onSaveTemplate(actionValue.trim(), plan)
      }
      closeLayer('action')
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'That did not work. Please try again.')
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) requestClose() }}>
      <Dialog.Portal>
        <Dialog.Content className="full-panel" aria-describedby={undefined} onEscapeKeyDown={(event) => { if (dirty) { event.preventDefault(); requestClose() } }}>
          <header className="panel-topbar">
            <button className="icon-button" aria-label="Back" onClick={requestClose}><ArrowLeft /></button>
            <div>
              <p className="eyebrow">{format(parseISO(date), 'EEEE').toUpperCase()}</p>
              <Dialog.Title>{format(parseISO(date), 'MMMM d')}</Dialog.Title>
            </div>
            {mode === 'detail' && plan ? <button className="icon-button" aria-label="More options" onClick={() => { setActionValue(format(addDays(parseISO(date), 1), 'yyyy-MM-dd')); setAction('duplicate'); openLayer('action') }}><MoreHorizontal /></button> : <span className="topbar-spacer" />}
          </header>

          {mode === 'edit' ? (
            <div className="panel-body editor-body">
              <label className="day-title-field"><span>NAME THIS DAY</span><input value={draft.title} onChange={(event) => { setDraft((value) => ({ ...value, title: event.target.value })); setSaveStatus('idle') }} placeholder="Full body reset" /></label>

              {templates.length > 0 && draft.exercises.length === 0 && (
                <div className="template-strip"><span>START WITH A ROUTINE</span><div>{templates.map((template) => <button key={template.id} onClick={() => applyTemplate(template)}>{template.name}</button>)}</div></div>
              )}

              <div className="editor-items">
                {draft.exercises.map((item, index) => (
                  <article className="editor-item" key={item.id}>
                    <ExerciseThumb src={item.imageUrl} name={item.name} category={item.category} />
                    <div className="editor-item-fields">
                      <span className="editor-item-name"><strong>{item.name}</strong><small>{bodyAreaLabel(item.bodyArea)}</small></span>
                      <input aria-label={`Target for ${item.name}`} value={item.target} onChange={(event) => setDraft((value) => ({ ...value, exercises: value.exercises.map((exercise) => exercise.id === item.id ? { ...exercise, target: event.target.value } : exercise) }))} placeholder="Target" />
                      <input aria-label={`Notes for ${item.name}`} value={item.notes} onChange={(event) => setDraft((value) => ({ ...value, exercises: value.exercises.map((exercise) => exercise.id === item.id ? { ...exercise, notes: event.target.value } : exercise) }))} placeholder="Optional note" />
                    </div>
                    <div className="reorder-actions">
                      <button aria-label={`Move ${item.name} up`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp /></button>
                      <button aria-label={`Move ${item.name} down`} disabled={index === draft.exercises.length - 1} onClick={() => move(index, 1)}><ArrowDown /></button>
                      <button aria-label={`Remove ${item.name}`} onClick={() => remove(item)}><Trash2 /></button>
                    </div>
                  </article>
                ))}
              </div>

              <button className="add-exercise-button" onClick={() => { setPickerOpen(true); openLayer('picker') }}><Plus /> Add exercise</button>
              {draft.exercises.length === 0 && <p className="editor-hint">Add at least one exercise to save this day.</p>}
            </div>
          ) : (
            <div className="panel-body day-detail">
              <div className="day-detail-heading">
                <div><p className="eyebrow">{complete ? 'COMPLETE' : editable ? 'YOUR PLAN' : 'PAST WORKOUT'}</p><h1>{plan?.title ?? 'Nothing planned'}</h1></div>
                {complete && <span className="complete-badge"><Check /></span>}
              </div>
              {plan?.exercises.map((exercise) => <ExerciseCard key={exercise.id} exercise={exercise} canComplete={date === today} offline={offline} onToggle={onToggle} />)}
              {plan?.reflection && <div className="past-reflection"><p className="eyebrow">WHAT WENT WELL</p><p>{plan.reflection}</p></div>}
              {editable && <button className="primary-button" onClick={() => setMode('edit')} disabled={offline}>Edit workout</button>}
              {plan && (
                <div className="quiet-actions">
                  <button onClick={() => { setActionValue(format(addDays(parseISO(date), 1), 'yyyy-MM-dd')); setAction('duplicate'); openLayer('action') }}><Copy /> Duplicate</button>
                  <button onClick={() => { setActionValue(plan.title); setAction('template'); openLayer('action') }}><Save /> Save routine</button>
                </div>
              )}
            </div>
          )}

          {mode === 'edit' && (
            <footer className="editor-footer">
              <span className={`save-indicator ${saveStatus}`} aria-live="polite">{saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? draft.exercises.length ? 'Couldn’t save' : 'Add an exercise' : dirty ? 'Unsaved changes' : 'No changes'}</span>
              <button className="primary-button compact" onClick={save} disabled={!dirty || offline || saveStatus === 'saving'}>Save changes</button>
            </footer>
          )}

          {action !== 'none' && (
            <div className="inline-action-overlay" role="presentation" onClick={() => closeLayer('action')}>
              <section className="inline-action-sheet" role="dialog" aria-modal="true" aria-labelledby="action-title" onClick={(event) => event.stopPropagation()}>
                <div className="sheet-heading"><h2 id="action-title">{action === 'duplicate' ? 'Duplicate workout' : 'Save as routine'}</h2><button className="icon-button" onClick={() => closeLayer('action')}><X /><span className="sr-only">Close</span></button></div>
                <label><span>{action === 'duplicate' ? 'Choose a date' : 'Routine name'}</span><input type={action === 'duplicate' ? 'date' : 'text'} min={action === 'duplicate' ? today : undefined} value={actionValue} onChange={(event) => setActionValue(event.target.value)} /></label>
                {actionError && <p className="form-message error">{actionError}</p>}
                <button className="primary-button" onClick={runAction}>{action === 'duplicate' ? <><CalendarPlus /> Duplicate workout</> : 'Save routine'}</button>
              </section>
            </div>
          )}

          <ExercisePicker open={pickerOpen} exercises={exercises} onOpenChange={(next) => { if (next) setPickerOpen(true); else closeLayer('picker') }} onPick={addExercise} />
        </Dialog.Content>
      </Dialog.Portal>

      <AlertDialog.Root open={confirmClose} onOpenChange={(next) => {
        if (next) setConfirmClose(true)
        else if (!discarding.current) keepEditing()
      }}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="dialog-overlay" />
          <AlertDialog.Content className="confirm-dialog">
            <AlertDialog.Title>Discard your changes?</AlertDialog.Title>
            <AlertDialog.Description>This workout will go back to its last saved version.</AlertDialog.Description>
            <div><AlertDialog.Cancel onClick={keepEditing}>Keep editing</AlertDialog.Cancel><AlertDialog.Action onClick={discardChanges}>Discard</AlertDialog.Action></div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </Dialog.Root>
  )
}
