import * as AlertDialog from '@radix-ui/react-alert-dialog'
import * as Dialog from '@radix-ui/react-dialog'
import { ArrowLeft, Check, Dumbbell } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Exercise, ExerciseSettings, WeightUnit } from '../types'
import { bodyAreaLabel, validateExerciseSettings } from '../lib/exercise'
import { ExerciseThumb } from './ExerciseThumb'

interface ExerciseDetailProps {
  exercise: Exercise
  offline: boolean
  onClose: () => void
  onSave: (exercise: Exercise, settings: ExerciseSettings) => Promise<void>
}

export function ExerciseDetail({ exercise, offline, onClose, onSave }: ExerciseDetailProps) {
  const [target, setTarget] = useState(exercise.defaultTarget)
  const [weight, setWeight] = useState(exercise.defaultWeight?.toString() ?? '')
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(exercise.defaultWeightUnit ?? 'lb')
  const [baseline, setBaseline] = useState(JSON.stringify([target, weight, weightUnit]))
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState('')
  const [confirmClose, setConfirmClose] = useState(false)
  const guarded = useRef(false)
  const discarding = useRef(false)
  const busy = status === 'saving'
  const current = JSON.stringify([target, weight, weightUnit])
  const dirty = current !== baseline

  useEffect(() => {
    if (dirty && !guarded.current && !confirmClose && !discarding.current) {
      window.history.pushState({ ...window.history.state, momentumOverlay: 'exercise', momentumLayer: 'exercise-dirty' }, '')
      guarded.current = true
    }
    const pop = (event: PopStateEvent) => {
      if (guarded.current && event.state?.momentumLayer !== 'exercise-dirty') {
        guarded.current = false
        if (busy) {
          window.history.pushState({ ...window.history.state, momentumOverlay: 'exercise', momentumLayer: 'exercise-dirty' }, '')
          guarded.current = true
        } else if (dirty) setConfirmClose(true)
      }
    }
    const unload = (event: BeforeUnloadEvent) => {
      if (dirty || busy) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('popstate', pop)
    window.addEventListener('beforeunload', unload)
    return () => { window.removeEventListener('popstate', pop); window.removeEventListener('beforeunload', unload) }
  }, [busy, confirmClose, dirty])

  function requestClose() {
    if (busy) return
    if (guarded.current) {
      if (!dirty) {
        guarded.current = false
        window.history.go(-2)
      } else window.history.back()
    } else if (dirty) setConfirmClose(true)
    else onClose()
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (offline || busy || !dirty) return
    const settings: ExerciseSettings = { target: target.trim(), weight: weight.trim() ? Number(weight) : null, weightUnit }
    const invalid = validateExerciseSettings(settings)
    if (invalid) { setError(invalid); setStatus('error'); return }
    setStatus('saving')
    setError('')
    try {
      await onSave(exercise, settings)
      setTarget(settings.target)
      setWeight(settings.weight?.toString() ?? '')
      setBaseline(JSON.stringify([settings.target, settings.weight?.toString() ?? '', settings.weightUnit]))
      setStatus('saved')
      if (guarded.current) {
        guarded.current = false
        window.history.back()
      }
    } catch {
      setStatus('error')
      setError('Your changes couldn’t be saved. Please try again.')
    }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) requestClose() }}>
      <Dialog.Portal>
        <Dialog.Content className="full-panel exercise-detail" aria-describedby="exercise-settings-description" onOpenAutoFocus={(event) => event.preventDefault()}>
          <header className="panel-topbar">
            <button className="icon-button" aria-label="Back to library" disabled={busy} onClick={requestClose}><ArrowLeft /></button>
            <div><p className="eyebrow">EXERCISE LIBRARY</p><span>Your exercise</span></div>
            <span className="topbar-spacer" />
          </header>
          <form className="exercise-detail-form" onSubmit={save}>
            <div className={`exercise-detail-hero focus-${exercise.bodyArea}`}>
              <ExerciseThumb src={exercise.imageUrl} name={exercise.name} category={exercise.category} />
              <div className="exercise-detail-identity">
                <span className={`focus-tag focus-${exercise.bodyArea}`}>{bodyAreaLabel(exercise.bodyArea)}</span>
                <Dialog.Title>{exercise.name}</Dialog.Title>
                <p><Dumbbell aria-hidden="true" /> {exercise.equipment}</p>
              </div>
            </div>
            <div className="exercise-settings-body">
              <h2>Make it yours.</h2>
              <Dialog.Description id="exercise-settings-description">Set your defaults for the next time you add this exercise. Saved workouts stay as they are.</Dialog.Description>
              <fieldset className="stack-form" disabled={offline || busy}>
                <label><span>Sets & reps <small>or duration</small></span><input value={target} maxLength={80} onChange={(event) => { setTarget(event.target.value); setStatus('idle') }} placeholder="e.g. 3 × 10 or 20 min" /></label>
                <div className="weight-fields">
                  <label><span>Weight <small>optional</small></span><input type="number" inputMode="decimal" min="0.01" max="10000" step="0.01" value={weight} onChange={(event) => { setWeight(event.target.value); setStatus('idle') }} placeholder="No weight" /></label>
                  <div className="unit-field"><span id="weight-unit-label">Unit</span><div className="unit-switch" role="group" aria-labelledby="weight-unit-label">{(['lb', 'kg'] as const).map((unit) => <button type="button" key={unit} aria-pressed={weightUnit === unit} onClick={() => { setWeightUnit(unit); setStatus('idle') }}>{unit}</button>)}</div></div>
                </div>
              </fieldset>
              {offline && <p className="form-message" role="status">Reconnect to edit your exercise settings.</p>}
              {error && <p className="form-message error" role="alert">{error}</p>}
            </div>
            <footer className="editor-footer">
              <span className={`save-indicator ${status}`} role="status">{busy ? 'Saving…' : status === 'error' ? 'Not saved' : dirty ? 'Unsaved changes' : status === 'saved' ? <><Check aria-hidden="true" /> Saved</> : 'Your personal defaults'}</span>
              <button type="submit" className="primary-button compact" disabled={offline || busy || !dirty}>{busy ? 'Saving…' : 'Save changes'}</button>
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
      <AlertDialog.Root open={confirmClose}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="dialog-overlay confirm-overlay" />
          <AlertDialog.Content className="confirm-dialog">
            <AlertDialog.Title>Discard your changes?</AlertDialog.Title>
            <AlertDialog.Description>Your saved reps and weight will stay as they were.</AlertDialog.Description>
            <div><AlertDialog.Cancel onClick={() => setConfirmClose(false)}>Keep editing</AlertDialog.Cancel><AlertDialog.Action onClick={() => { discarding.current = true; guarded.current = false; setConfirmClose(false); onClose() }}>Discard</AlertDialog.Action></div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </Dialog.Root>
  )
}
