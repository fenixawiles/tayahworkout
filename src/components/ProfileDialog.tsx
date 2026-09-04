import * as Dialog from '@radix-ui/react-dialog'
import { Download, LogOut, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Profile } from '../types'

interface ProfileDialogProps {
  open: boolean
  profile: Profile
  canInstall: boolean
  isDemo: boolean
  onOpenChange: (open: boolean) => void
  onSave: (profile: Profile) => Promise<void>
  onInstall: () => void
  onSignOut: () => void
}

export function ProfileDialog({ open, profile, canInstall, isDemo, onOpenChange, onSave, onInstall, onSignOut }: ProfileDialogProps) {
  const [displayName, setDisplayName] = useState(profile.displayName)
  const [timeZone, setTimeZone] = useState(profile.timeZone)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => { setDisplayName(profile.displayName); setTimeZone(profile.timeZone) }, [profile])

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setStatus('saving')
    try {
      await onSave({ ...profile, displayName: displayName.trim(), timeZone })
      setStatus('saved')
    } catch {
      setStatus('error')
    }
  }

  const timeZones = Array.from(new Set([profile.timeZone, Intl.DateTimeFormat().resolvedOptions().timeZone, 'America/Chicago', 'America/New_York', 'America/Denver', 'America/Los_Angeles', 'UTC']))

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="bottom-sheet profile-sheet" aria-describedby={undefined}>
          <div className="sheet-handle" aria-hidden="true" />
          <div className="sheet-heading">
            <Dialog.Title>Your profile</Dialog.Title>
            <Dialog.Close className="icon-button"><X /><span className="sr-only">Close</span></Dialog.Close>
          </div>
          <form className="stack-form" onSubmit={save}>
            <label><span>Name</span><input value={displayName} onChange={(event) => { setDisplayName(event.target.value); setStatus('idle') }} required /></label>
            <label><span>Workout timezone</span><select value={timeZone} onChange={(event) => { setTimeZone(event.target.value); setStatus('idle') }}>{timeZones.map((zone) => <option key={zone} value={zone}>{zone.replaceAll('_', ' ')}</option>)}</select></label>
            <p className="field-help">Your workout day closes at midnight in this timezone.</p>
            <div className="profile-save-row"><span aria-live="polite">{status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : status === 'error' ? 'Couldn’t save' : ''}</span><button className="secondary-button" disabled={status === 'saving' || !displayName.trim()}>Save profile</button></div>
          </form>
          {canInstall && <button className="settings-row" onClick={onInstall}><Download /><span><b>Install Momentum</b><small>Add it to your Android home screen</small></span></button>}
          <button className="settings-row signout" onClick={onSignOut}><LogOut /><span><b>{isDemo ? 'Leave preview' : 'Sign out'}</b><small>{isDemo ? 'Your preview stays on this device' : 'Your progress will stay safely saved'}</small></span></button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
