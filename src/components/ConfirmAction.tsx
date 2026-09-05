import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { useState } from 'react'
import { readableError } from '../lib/community'

export interface Confirmation { title: string; description: string; label: string; action: () => Promise<void> }
export function ConfirmAction({ value, onClose }: { value: Confirmation | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <AlertDialog.Root open={Boolean(value)} onOpenChange={(open) => { if (!open && !busy) { setError(''); onClose() } }}>
    <AlertDialog.Portal><AlertDialog.Overlay className="dialog-overlay" /><AlertDialog.Content className="confirm-dialog">
      <AlertDialog.Title>{value?.title}</AlertDialog.Title><AlertDialog.Description>{value?.description}</AlertDialog.Description>
      {error && <p className="form-message error" role="alert">{error}</p>}
      <div className="confirm-actions"><AlertDialog.Cancel className="secondary-button" disabled={busy}>Keep it</AlertDialog.Cancel><button className="primary-button danger-button" disabled={busy} onClick={async () => {
        setBusy(true); setError('')
        try { await value?.action(); onClose() } catch (caught) { setError(readableError(caught)) } finally { setBusy(false) }
      }}>{busy ? 'Working…' : value?.label}</button></div>
    </AlertDialog.Content></AlertDialog.Portal>
  </AlertDialog.Root>
}
