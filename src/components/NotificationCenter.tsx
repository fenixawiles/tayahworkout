import * as Dialog from '@radix-ui/react-dialog'
import { Bell, BellRing, Check, Dumbbell, UserPlus, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { communityRpc, emptyCommunity, loadCommunity, readableError } from '../lib/community'
import type { DayPlan } from '../types'

type NotificationTab = 'requests' | 'reminders'

function readSeen(key: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(-200) : []
  } catch {
    return []
  }
}

export function NotificationCenter({ profileId, today, plan, demo, offline, onOpenToday }: {
  profileId: string
  today: string
  plan?: DayPlan
  demo: boolean
  offline: boolean
  onOpenToday: () => void
}) {
  const storageKey = `momentum-seen-notifications-${profileId}`
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<NotificationTab>('requests')
  const [seen, setSeen] = useState<string[]>(() => readSeen(storageKey))
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const community = useQuery({
    queryKey: ['community', profileId],
    queryFn: () => loadCommunity(demo),
    staleTime: 15_000,
    refetchInterval: offline ? false : 30_000,
  })
  const data = community.data ?? emptyCommunity
  const requests = data.relationships.filter((item) => item.status === 'pending' && item.incoming)
  const incomplete = Boolean(plan?.exercises.length && plan.exercises.some((item) => !item.completedAt))
  const completedCount = plan?.exercises.filter((item) => item.completedAt).length ?? 0
  const notificationIds = useMemo(() => [
    ...requests.map((item) => `friend-request:${item.id}`),
    ...(incomplete && plan ? [`workout-reminder:${today}:${plan.id}`] : []),
  ], [incomplete, plan, requests, today])
  const unread = notificationIds.filter((id) => !seen.includes(id)).length

  function markCurrentRead() {
    if (!notificationIds.length) return
    setSeen((current) => {
      const next = [...new Set([...current, ...notificationIds])].slice(-200)
      localStorage.setItem(storageKey, JSON.stringify(next))
      return next
    })
  }

  useEffect(() => {
    const pop = (event: PopStateEvent) => {
      if (!event.state?.notificationCenter) setOpen(false)
    }
    window.addEventListener('popstate', pop)
    return () => window.removeEventListener('popstate', pop)
  }, [])

  useEffect(() => {
    if (open) markCurrentRead()
    // Mark newly loaded items as read while the center is already open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, notificationIds.join('|')])

  function openCenter() {
    markCurrentRead()
    setError('')
    setOpen(true)
    window.history.pushState({ ...window.history.state, notificationCenter: true }, '')
  }

  function closeCenter() {
    if (window.history.state?.notificationCenter) window.history.back()
    else setOpen(false)
  }

  function closeAndOpenToday() {
    closeCenter()
    window.setTimeout(onOpenToday, 0)
  }

  async function respond(requestId: string, action: 'accept' | 'decline') {
    setBusyId(requestId); setError('')
    try {
      await communityRpc('respond_friend_request', { p_request_id: requestId, p_action: action }, demo)
      await community.refetch()
    } catch (caught) {
      setError(readableError(caught))
    } finally {
      setBusyId('')
    }
  }

  return <>
    <button className="icon-button notification-bell" aria-label={unread ? `Open notifications, ${unread} unread` : 'Open notifications'} onClick={openCenter}>
      <Bell aria-hidden="true" />
      {unread > 0 && <span className="notification-badge" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}
    </button>
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) closeCenter() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="full-panel notification-panel" aria-describedby="notification-description">
          <header className="panel-topbar">
            <span className="topbar-spacer" />
            <div><Dialog.Title>Notifications</Dialog.Title><Dialog.Description id="notification-description">Requests and today’s gentle nudge.</Dialog.Description></div>
            <button className="icon-button" aria-label="Close notifications" onClick={closeCenter}><X /></button>
          </header>
          <div className="notification-body">
            <div className="notification-tabs" role="tablist" aria-label="Notification categories">
              <button role="tab" aria-selected={tab === 'requests'} className={tab === 'requests' ? 'selected' : ''} onClick={() => setTab('requests')}>Friend requests <span>{requests.length}</span></button>
              <button role="tab" aria-selected={tab === 'reminders'} className={tab === 'reminders' ? 'selected' : ''} onClick={() => setTab('reminders')}>Reminders <span>{incomplete ? 1 : 0}</span></button>
            </div>
            {error && <p className="form-message error" role="alert">{error}</p>}
            {tab === 'requests' && <section role="tabpanel" className="notification-list">
              {community.isPending && <p className="info-note" role="status">Checking for new requests…</p>}
              {!community.isPending && requests.length === 0 && <div className="calm-empty"><UserPlus /><h2>No friend requests</h2><p>New requests will appear here and on the bell.</p></div>}
              {requests.map((request) => <article className="notification-card" key={request.id}>
                <span className="person-avatar">{request.person.name[0]}</span>
                <div><b>{request.person.name}</b><small>@{request.person.username} would like to be friends.</small></div>
                <div className="notification-actions">
                  <button className="secondary-button" disabled={offline || Boolean(busyId) || data.restricted} onClick={() => void respond(request.id, 'accept')}><Check />Accept</button>
                  <button className="text-button" disabled={offline || Boolean(busyId)} onClick={() => void respond(request.id, 'decline')}>Decline</button>
                </div>
              </article>)}
            </section>}
            {tab === 'reminders' && <section role="tabpanel" className="notification-list">
              {incomplete && plan ? <article className="notification-card reminder-card">
                <span className="notification-symbol"><BellRing /></span>
                <div><b>{plan.title || 'Today’s workout'}</b><small>{completedCount} of {plan.exercises.length} exercises complete. Your plan is waiting when you’re ready.</small></div>
                <button className="secondary-button" onClick={closeAndOpenToday}><Dumbbell />Open today</button>
              </article> : <div className="calm-empty"><Check /><h2>You’re all caught up</h2><p>{plan?.exercises.length ? 'Today’s workout is complete.' : 'There isn’t a saved workout to remind you about today.'}</p></div>}
              <p className="notification-footnote">These reminders appear inside Momentum. Email reminders are separate and remain off until delivery is configured.</p>
            </section>}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </>
}
