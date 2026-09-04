import * as Dialog from '@radix-ui/react-dialog'
import { Camera, Check, ChevronDown, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { BodyArea, ExerciseCategory } from '../types'
import { validateExerciseImage } from '../lib/exercise'

interface CustomExerciseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (input: { name: string; category: ExerciseCategory; bodyArea: BodyArea; equipment: string; target: string; file: File | null }) => Promise<void>
}

export function CustomExerciseDialog({ open, onOpenChange, onSave }: CustomExerciseDialogProps) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<ExerciseCategory>('strength')
  const [bodyArea, setBodyArea] = useState<BodyArea>('full-body')
  const [equipment, setEquipment] = useState('')
  const [target, setTarget] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [choice, setChoice] = useState<'category' | 'focus' | null>(null)

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      if (event.state?.momentumLayer !== 'exercise-choice') setChoice(null)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  function openChoice(next: 'category' | 'focus') {
    setChoice(next)
    window.history.pushState({ ...(window.history.state ?? {}), momentumOverlay: 'custom', momentumLayer: 'exercise-choice' }, '')
  }

  function closeChoice() {
    if (window.history.state?.momentumLayer === 'exercise-choice') window.history.back()
    else setChoice(null)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onSave({ name: name.trim(), category, bodyArea, equipment: equipment.trim() || 'None', target: target.trim(), file })
      setName(''); setEquipment(''); setTarget(''); setFile(null); setPreview(null)
      onOpenChange(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save this exercise.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="bottom-sheet custom-sheet" aria-describedby={undefined}>
          <div className="sheet-handle" aria-hidden="true" />
          <div className="sheet-heading">
            <Dialog.Title>Create an exercise</Dialog.Title>
            <Dialog.Close className="icon-button"><X /><span className="sr-only">Close</span></Dialog.Close>
          </div>
          <form className="stack-form" onSubmit={submit}>
            <label className="photo-field">
              {preview ? <img src={preview} alt="Selected exercise" /> : <span><Camera /><b>Add a photo</b><small>Optional · compressed before upload</small></span>}
              <input type="file" accept="image/*" onChange={(event) => {
                const next = event.target.files?.[0] ?? null
                const validationError = validateExerciseImage(next)
                if (validationError) { setError(validationError); event.target.value = ''; return }
                setError('')
                setFile(next)
                setPreview(next ? URL.createObjectURL(next) : null)
              }} />
            </label>
            <label><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} required placeholder="Exercise name" /></label>
            <div className="field-row">
              <label><span>Category</span><button type="button" className="choice-field" onClick={() => openChoice('category')}><b>{category === 'bodyweight' ? 'Bodyweight' : category[0].toUpperCase() + category.slice(1)}</b><ChevronDown aria-hidden="true" /></button></label>
              <label><span>Focus tag</span><button type="button" className="choice-field" onClick={() => openChoice('focus')}><b>{bodyArea === 'upper-body' ? 'Upper body' : bodyArea === 'lower-body' ? 'Lower body' : bodyArea === 'full-body' ? 'Full body' : 'Core'}</b><ChevronDown aria-hidden="true" /></button></label>
            </div>
            <label><span>Equipment</span><input value={equipment} onChange={(event) => setEquipment(event.target.value)} placeholder="None" /></label>
            <label><span>Default target</span><input value={target} onChange={(event) => setTarget(event.target.value)} placeholder="3 × 10 or 20 minutes" /></label>
            {error && <p className="form-message error" role="alert">{error}</p>}
            <button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save exercise'}</button>
          </form>

          {choice && (
            <div className="choice-overlay" onClick={closeChoice}>
              <section className="choice-sheet" role="dialog" aria-modal="true" aria-labelledby="choice-title" onClick={(event) => event.stopPropagation()}>
                <div className="sheet-handle" aria-hidden="true" />
                <div className="choice-heading"><h2 id="choice-title">{choice === 'category' ? 'Choose a category' : 'Choose a focus tag'}</h2><button type="button" className="icon-button" aria-label="Close choices" onClick={closeChoice}><X /></button></div>
                <div className="choice-list">
                  {(choice === 'category'
                    ? ([['strength', 'Strength'], ['bodyweight', 'Bodyweight'], ['cardio', 'Cardio'], ['mobility', 'Mobility'], ['recovery', 'Recovery']] as const)
                    : ([['upper-body', 'Upper body'], ['lower-body', 'Lower body'], ['core', 'Core'], ['full-body', 'Full body']] as const)
                  ).map(([value, label]) => {
                    const selected = choice === 'category' ? category === value : bodyArea === value
                    return <button type="button" key={value} className={selected ? 'selected' : ''} onClick={() => { if (choice === 'category') setCategory(value as ExerciseCategory); else setBodyArea(value as BodyArea); closeChoice() }}><span>{label}</span>{selected && <Check aria-hidden="true" />}</button>
                  })}
                </div>
              </section>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
