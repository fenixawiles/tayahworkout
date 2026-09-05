import * as Dialog from '@radix-ui/react-dialog'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { ArrowLeft, Check, ChevronDown, Copy, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Profile } from '../types'
import { normalizeUsername, readableError, usernameError } from '../lib/community'

export function ProfileDialog({ profile, offline, onClose, onSave }: { profile: Profile; offline: boolean; onClose: () => void; onSave: (profile: Profile) => Promise<void> }) {
  const [name, setName] = useState(profile.displayName)
  const [username, setUsername] = useState(profile.username ?? '')
  const [zone, setZone] = useState(profile.timeZone)
  const [baseline, setBaseline] = useState(JSON.stringify([name, username, zone]))
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [choosingZone, setChoosingZone] = useState(false)
  const [zoneSearch, setZoneSearch] = useState('')
  const [confirmClose, setConfirmClose] = useState(false)
  const guarded = useRef(false)
  const discarding = useRef(false)
  const dirty = JSON.stringify([name, username, zone]) !== baseline
  const busy = status === 'saving'
  const zones = Array.from(new Set([profile.timeZone, Intl.DateTimeFormat().resolvedOptions().timeZone, 'UTC', ...Intl.supportedValuesOf('timeZone')]))
    .filter((item) => item.toLowerCase().replaceAll('_', ' ').includes(zoneSearch.toLowerCase()))

  useEffect(() => {
    if (dirty && !guarded.current && !confirmClose && !discarding.current && !choosingZone) {
      window.history.pushState({ ...window.history.state, momentumOverlay: 'profile', momentumLayer: 'profile-dirty' }, ''); guarded.current = true
    }
    const pop = (event: PopStateEvent) => {
      if (!event.state?.profileZone) setChoosingZone(false)
      if (guarded.current && event.state?.momentumLayer !== 'profile-dirty') {
        guarded.current = false
        if (busy) { window.history.pushState({ ...window.history.state, momentumOverlay: 'profile', momentumLayer: 'profile-dirty' }, ''); guarded.current = true }
        else if (dirty) setConfirmClose(true)
      }
    }
    const unload = (event: BeforeUnloadEvent) => { if (dirty || busy) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('popstate', pop); window.addEventListener('beforeunload', unload)
    return () => { window.removeEventListener('popstate', pop); window.removeEventListener('beforeunload', unload) }
  }, [busy, choosingZone, confirmClose, dirty])
  function close() {
    if (busy) return
    if (guarded.current) { if (!dirty) { guarded.current = false; window.history.go(-2) } else window.history.back() }
    else if (dirty) setConfirmClose(true)
    else onClose()
  }
  function closeZones() { if (window.history.state?.profileZone) window.history.back(); else setChoosingZone(false) }
  return <Dialog.Root open onOpenChange={(open) => { if (!open) close() }}><Dialog.Portal><Dialog.Content className="full-panel profile-editor" aria-describedby="profile-description">
    <header className="panel-topbar"><button className="icon-button" aria-label="Back from profile" onClick={close} disabled={busy}><ArrowLeft /></button><div><p className="eyebrow">YOUR SPACE</p><Dialog.Title>Your profile</Dialog.Title></div><span className="topbar-spacer" /></header>
    <form className="stack-form account-form" onSubmit={async (event) => {
      event.preventDefault(); if (busy || offline || !dirty) return
      const invalid = usernameError(username); if (invalid) { setStatus('error'); setError(invalid); return }
      setStatus('saving'); setError('')
      const next = { ...profile, displayName: name.trim(), username: normalizeUsername(username) || null, timeZone: zone }
      try { await onSave(next); setName(next.displayName); setUsername(next.username ?? ''); setBaseline(JSON.stringify([next.displayName, next.username ?? '', zone])); setStatus('saved'); if (guarded.current) { guarded.current = false; window.history.back() } } catch (caught) { setStatus('error'); setError(readableError(caught)) }
    }}><Dialog.Description id="profile-description">Your name is how Momentum greets you. A username lets friends find you without sharing your email.</Dialog.Description>
      <fieldset className="stack-form" disabled={busy || offline}>
        <label><span>Display name</span><input value={name} onChange={(e) => { setName(e.target.value); setStatus('idle') }} required maxLength={60} autoComplete="name" /></label>
        <label><span>Username <small>optional until you add friends</small></span><input value={username} onChange={(e) => { setUsername(e.target.value); setStatus('idle') }} maxLength={25} placeholder="e.g. tayah_moves" autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-describedby="username-help" /></label><p className="field-help" id="username-help">3–24 letters, numbers, or underscores, starting with a letter. Unique, exact-match lookup. Change at most once every 30 days.</p>
        <div className="profile-code"><span>Your permanent friend code</span><div><code>{profile.friendCode?.match(/.{1,4}/g)?.join('-') ?? 'Available after sign-in'}</code><button type="button" className="icon-button" aria-label="Copy your friend code" disabled={!profile.friendCode} onClick={async () => { try { await navigator.clipboard.writeText(profile.friendCode!); setNotice('Friend code copied.') } catch { setNotice('Select and copy the code above.') } }}><Copy /></button></div><small>This stays the same if your username changes.</small></div>
        <label><span>Workout timezone</span><button type="button" className="choice-field" onClick={() => { setChoosingZone(true); setZoneSearch(''); window.history.pushState({ ...window.history.state, profileZone: true, momentumOverlay: 'profile' }, '') }}><b>{zone.replaceAll('_', ' ')}</b><ChevronDown /></button></label>
        <p className="field-help">Your workout day closes at midnight here. Changes are limited to once every 30 days and locked during accepted challenges.</p>
      </fieldset>
      {notice && <p role="status" className="field-help">{notice}</p>}{error && <p className="form-message error" role="alert">{error}</p>}{offline && <p className="info-note">Reconnect to edit your profile.</p>}
      <footer className="editor-save-footer"><span className="save-indicator" role="status">{busy ? 'Saving…' : status === 'error' ? 'Not saved' : dirty ? 'Unsaved changes' : status === 'saved' ? 'Saved' : 'Only you can edit this'}</span><button className="primary-button" disabled={busy || offline || !dirty || !name.trim()}>{busy ? 'Saving…' : 'Save changes'}</button></footer>
    </form>
    <Dialog.Root open={choosingZone} onOpenChange={(open) => { if (!open) closeZones() }}><Dialog.Portal><Dialog.Overlay className="dialog-overlay nested-overlay" /><Dialog.Content className="bottom-sheet timezone-sheet" aria-describedby={undefined}><div className="sheet-heading"><Dialog.Title>Workout timezone</Dialog.Title><button className="icon-button" aria-label="Close timezones" onClick={closeZones}><X /></button></div><label className="search-field"><Search /><input aria-label="Search timezones" value={zoneSearch} onChange={(e) => setZoneSearch(e.target.value)} placeholder="Search a city or region" /></label><div className="timezone-options">{zones.length ? zones.map((value) => <button className={value === zone ? 'selected' : ''} key={value} onClick={() => { setZone(value); setStatus('idle'); closeZones() }}><span>{value.replaceAll('_', ' ')}</span>{value === zone && <Check />}</button>) : <p>No matching timezones.</p>}</div></Dialog.Content></Dialog.Portal></Dialog.Root>
  </Dialog.Content></Dialog.Portal>
    <AlertDialog.Root open={confirmClose}><AlertDialog.Portal><AlertDialog.Overlay className="dialog-overlay confirm-overlay" /><AlertDialog.Content className="confirm-dialog"><AlertDialog.Title>Discard profile changes?</AlertDialog.Title><AlertDialog.Description>Your saved name, username, and timezone will stay as they were.</AlertDialog.Description><div><AlertDialog.Cancel onClick={() => setConfirmClose(false)}>Keep editing</AlertDialog.Cancel><AlertDialog.Action onClick={() => { discarding.current = true; guarded.current = false; setConfirmClose(false); onClose() }}>Discard</AlertDialog.Action></div></AlertDialog.Content></AlertDialog.Portal></AlertDialog.Root>
  </Dialog.Root>
}
