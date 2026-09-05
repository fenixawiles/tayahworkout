import { ArrowLeft, Bell, ChevronRight, Download, FileText, Flag, HelpCircle, LogOut, Shield, UserRound, Users } from 'lucide-react'
import { useEffect, useState, type ComponentType } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { AppData } from '../types'
import { communityRpc, emptyAccountSettings, loadAccountSettings, loadCommunity, readableError, type CommunityData, type ModerationQueue } from '../lib/community'
import { FriendsView } from './FriendsView'
import { CompetitionsView } from './CompetitionsView'
import { LegalContent } from './LegalContent'
import { ConfirmAction, type Confirmation } from './ConfirmAction'

type Section = 'friends' | 'challenges' | 'reminders' | 'privacy' | 'terms' | 'support' | 'moderation' | null
const sectionTitles = { friends: 'Friends', challenges: 'Challenges', reminders: 'Reminders', privacy: 'Privacy policy', terms: 'Terms of use', support: 'Help & privacy requests', moderation: 'Review queue' }
function fromUrl(): Section { const value = new URLSearchParams(location.search).get('section'); return value && value in sectionTitles ? value as Section : null }

function MoreRow({ icon: Icon, title, detail, badge, onClick }: { icon: ComponentType<{ 'aria-hidden'?: boolean }>; title: string; detail: string; badge?: number; onClick: () => void }) {
  return <button className="more-row" onClick={onClick}><span className="more-row-icon"><Icon aria-hidden /></span><span><b>{title}</b><small>{detail}</small></span>{Boolean(badge) && <span className="count-badge">{badge}</span>}<ChevronRight aria-hidden /></button>
}

export function MoreView({ appData, today, demo, offline, canInstall, onProfile, onInstall, onSignOut }: { appData: AppData; today: string; demo: boolean; offline: boolean; canInstall: boolean; onProfile: () => void; onInstall: () => void; onSignOut: () => void }) {
  const [section, setSection] = useState<Section>(fromUrl)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<Confirmation | null>(null)
  const community = useQuery({ queryKey: ['community', appData.profile.id], queryFn: () => loadCommunity(demo), staleTime: 15_000, refetchInterval: offline ? false : 60_000 })
  const settings = useQuery({ queryKey: ['account-settings', appData.profile.id], queryFn: () => loadAccountSettings(demo), staleTime: 30_000 })
  const account = settings.data ?? emptyAccountSettings

  useEffect(() => {
    if (fromUrl() && !window.history.state?.moreSection) {
      const full = new URL(location.href); const root = new URL(location.href); root.searchParams.delete('section')
      window.history.replaceState({}, '', root); window.history.pushState({ moreSection: fromUrl() }, '', full)
    }
    const pop = () => { setSection(fromUrl()); setNotice(''); setError('') }
    window.addEventListener('popstate', pop); return () => window.removeEventListener('popstate', pop)
  }, [])

  function open(next: Section) {
    const url = new URL(location.href); if (next) url.searchParams.set('section', next); else url.searchParams.delete('section')
    window.history.pushState({ moreSection: next }, '', url); setSection(next); setNotice(''); setError(''); window.scrollTo(0, 0)
  }
  function back() { if (window.history.state?.moreSection) window.history.back(); else { setSection(null); const url = new URL(location.href); url.searchParams.delete('section'); window.history.replaceState({}, '', url) } }
  async function exportWorkouts() {
    setBusy(true); setError('')
    try {
      const content = { format: 'momentum-workout-export-v1', exportedAt: new Date().toISOString(), ...appData }
      const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob)
      const link = document.createElement('a'); link.href = url; link.download = `momentum-workouts-${today}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice('Workout export downloaded. Keep it somewhere private. Photo access links expire; original image files are not included.')
    } catch { setError('Could not prepare the download. Please try again.') } finally { setBusy(false) }
  }
  const pending = community.data?.relationships.filter((r) => r.status === 'pending' && r.incoming).length ?? 0
  const invitations = community.data?.competitions.filter((c) => c.status === 'pending' && c.incoming && !c.expired).length ?? 0
  const needsCommunity = ['friends', 'challenges', 'support', 'moderation'].includes(section ?? '')

  return <section className="view-section more-view">
    <header className="more-heading">{section && <button className="icon-button" aria-label="Back in More" onClick={back}><ArrowLeft /></button>}<div><p className="eyebrow">YOUR SPACE</p><h1>{section ? sectionTitles[section] : 'A little more.'}</h1></div></header>
    {notice && <p className="form-message success" role="status">{notice}</p>}{error && <p className="form-message error" role="alert">{error}</p>}
    {!section && <>
      <button className="more-profile-card" onClick={onProfile}><span className="person-avatar">{appData.profile.displayName[0]}</span><span><b>{appData.profile.displayName}</b><small>{appData.profile.username ? `@${appData.profile.username}` : 'Edit profile & choose a username'}</small></span><ChevronRight /></button>
      <div className="more-group"><MoreRow icon={Users} title="Friends" detail="Your people, at your pace" badge={pending} onClick={() => open('friends')} /><MoreRow icon={Flag} title="Challenges" detail="A little friendly accountability" badge={invitations} onClick={() => open('challenges')} /></div>
      <div className="more-group"><MoreRow icon={UserRound} title="Profile & timezone" detail="Name, username, and your workout day" onClick={onProfile} />{account.remindersReady && <MoreRow icon={Bell} title="Workout reminders" detail={account.reminderEnabled ? 'On · 5pm in your timezone' : 'Off · a gentle email nudge'} onClick={() => open('reminders')} />}{canInstall && <MoreRow icon={Download} title="Install Momentum" detail="Keep your journal on your home screen" onClick={onInstall} />}</div>
      <div className="more-group"><MoreRow icon={HelpCircle} title="Help & privacy requests" detail="Support, data questions, or account deletion" onClick={() => open('support')} /><MoreRow icon={Shield} title="Privacy policy" detail="What’s saved and who can see it" onClick={() => open('privacy')} /><MoreRow icon={FileText} title="Terms of use" detail="The ground rules" onClick={() => open('terms')} />{community.data?.isModerator && <MoreRow icon={Shield} title="Review queue" detail="Private community and support cases" onClick={() => open('moderation')} />}</div>
      <button className="settings-row signout" onClick={() => setConfirm({ title: demo ? 'Leave this preview?' : 'Sign out of Momentum?', description: demo ? 'Your preview workouts stay on this device.' : 'Your saved workouts stay in your account. The local workout cache is removed from this browser.', label: demo ? 'Leave preview' : 'Sign out', action: async () => onSignOut() })}><LogOut /><span><b>{demo ? 'Leave preview' : 'Sign out'}</b></span></button>
      <p className="more-footnote">Momentum · a personal workout journal</p>
    </>}
    {(section === 'privacy' || section === 'terms') && <LegalContent page={section} />}
    {needsCommunity && community.isPending && <p role="status" className="info-note">Getting things ready…</p>}
    {needsCommunity && community.error && !community.data && <div className="calm-empty"><h2>Couldn’t load this yet</h2><p>{readableError(community.error)}</p><button className="secondary-button" onClick={() => void community.refetch()}>Try again</button></div>}
    {needsCommunity && community.data && <>
      {community.isRefetchError && <p className="info-note">Couldn’t refresh. This is the last loaded information.</p>}
      {section === 'friends' && <FriendsView profile={appData.profile} data={community.data} demo={demo} offline={offline} onRefresh={community.refetch} onProfile={onProfile} onChallenges={() => open('challenges')} />}
      {section === 'challenges' && <CompetitionsView data={community.data} today={today} demo={demo} offline={offline} onRefresh={community.refetch} onFriends={() => open('friends')} />}
      {section === 'support' && <SupportView data={community.data} demo={demo} offline={offline} busyExport={busy} onExport={exportWorkouts} onRefresh={community.refetch} />}
      {section === 'moderation' && community.data.isModerator && <ModerationView demo={demo} offline={offline} />}
    </>}
    {section === 'reminders' && <div className="community-page"><p className="section-intro">One gentle email around 5pm in {appData.profile.timeZone.replaceAll('_', ' ')}—only if today has a saved, unfinished workout.</p>{account.remindersReady ? <><button className="preference-switch" role="switch" aria-checked={account.reminderEnabled} disabled={busy || offline} onClick={async () => {
      setBusy(true); setError(''); try { await communityRpc('set_workout_reminder', { p_enabled: !account.reminderEnabled }, demo); await settings.refetch(); setNotice(account.reminderEnabled ? 'Reminders turned off.' : 'Reminders turned on.') } catch (caught) { setError(readableError(caught)) } finally { setBusy(false) }
    }}><span><b>Workout reminder</b><small>{busy ? 'Saving…' : account.reminderEnabled ? 'On · email' : 'Off'}</small></span><i aria-hidden className={account.reminderEnabled ? 'on' : ''} /></button><p className="field-help">No email for rest days or finished workouts. At most one per day. Turn it off here or unsubscribe in any reminder. Delivery can be delayed by your email provider; this is not an alarm.</p></> : <p className="info-note">Email reminders aren’t available in this release.</p>}</div>}
    <ConfirmAction value={confirm} onClose={() => setConfirm(null)} />
  </section>
}

function SupportView({ data, demo, offline, busyExport, onExport, onRefresh }: { data: CommunityData; demo: boolean; offline: boolean; busyExport: boolean; onExport: () => Promise<void>; onRefresh: () => Promise<unknown> }) {
  const [kind, setKind] = useState('support'); const [details, setDetails] = useState(''); const [confirmedDelete, setConfirmedDelete] = useState(false)
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('')
  return <div className="community-page"><p className="section-intro">Send a private request to the operator. Updates and replies appear here. Review is manual, not immediate.</p>
    <button className="secondary-button" disabled={busyExport} onClick={() => void onExport()}><Download />{busyExport ? 'Preparing…' : 'Download workout data'}</button><p className="field-help">A JSON copy of the journal loaded on this device. Reconnect and refresh first for the latest data. For a full account-data request, choose Privacy below.</p>
    <form className="stack-form" onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setError(''); setNotice('')
      try { const id = await communityRpc('submit_support_request', { p_kind: kind, p_details: details }, demo); setDetails(''); setConfirmedDelete(false); await onRefresh(); setNotice(`Request received. Reference ${String(id).slice(0, 8)}. Follow its status below.`) } catch (caught) { setError(readableError(caught)) } finally { setBusy(false) }
    }}><fieldset className="radio-choices"><legend>What can we help with?</legend>{[['support', 'Something isn’t working'], ['privacy', 'Privacy or full data request'], ['delete-account', 'Delete my account']].map(([value, label]) => <label key={value}><input type="radio" name="supportKind" checked={kind === value} onChange={() => { setKind(value); setConfirmedDelete(false) }} />{label}</label>)}</fieldset><label><span>Details</span><textarea rows={4} value={details} onChange={(e) => setDetails(e.target.value)} required maxLength={2000} placeholder="Tell us what you need. Please leave out passwords and unnecessary medical information." /></label>
      {kind === 'delete-account' && <div className="deletion-notice"><p>Once processed, your account, workout journal, and uploaded photos are permanently removed. Shared challenges end. Limited safety records may remain as described in the Privacy policy. Download anything you want to keep first.</p><label className="check-label"><input type="checkbox" checked={confirmedDelete} onChange={(e) => setConfirmedDelete(e.target.checked)} />I want to request permanent account deletion.</label><p>You can cancel while the request is open. Sending this request does not immediately delete anything.</p></div>}
      {error && <p role="alert" className="form-message error">{error}</p>}{notice && <p role="status" className="form-message success">{notice}</p>}
      <button className="primary-button" disabled={busy || offline || !details.trim() || (kind === 'delete-account' && !confirmedDelete)}>{busy ? 'Sending…' : 'Send private request'}</button>
    </form>
    {data.requests.length > 0 && <section className="community-group"><h2>Your requests</h2>{data.requests.map((r) => <article className="case-receipt" key={r.id}><b>{r.kind?.replaceAll('-', ' ')} · {r.status}</b><small>Reference {r.id.slice(0, 8)} · {new Date(r.createdAt).toLocaleDateString()}</small>{r.response && <p>{r.response}</p>}{['open', 'reviewing'].includes(r.status) && <button className="text-button" disabled={busy || offline} onClick={async () => { setBusy(true); setError(''); try { await communityRpc('cancel_support_request', { p_id: r.id }, demo); await onRefresh() } catch (caught) { setError(readableError(caught)) } finally { setBusy(false) } }}>Cancel request</button>}</article>)}</section>}
  </div>
}

function ModerationView({ demo, offline }: { demo: boolean; offline: boolean }) {
  const queue = useQuery({ queryKey: ['moderation'], queryFn: async () => await communityRpc('get_moderation_queue', {}, demo) as unknown as ModerationQueue })
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  if (queue.isPending) return <p role="status">Loading cases…</p>
  if (queue.error) return <p role="alert">{readableError(queue.error)}</p>
  const cases = [...(queue.data?.reports ?? []).map((item) => ({ ...item, caseType: 'report' })), ...(queue.data?.requests ?? []).map((item) => ({ ...item, caseType: 'request' }))]
  return <div className="community-page"><p className="info-note">Private moderator access. Review context, record a clear response, and never disclose the reporter to the reported person. Account deletion requires the operator’s separate verified deletion workflow; resolving a case does not delete an account.</p>{error && <p className="form-message error" role="alert">{error}</p>}{!cases.length && <p>No open cases.</p>}{cases.map((item) => <form className="case-receipt stack-form" key={item.id} onSubmit={async (event) => {
    event.preventDefault(); const fields = new FormData(event.currentTarget); setBusy(true); setError('')
    try { await communityRpc('review_community_case', { p_id: item.id, p_kind: item.caseType, p_status: String(fields.get('status')), p_response: String(fields.get('response')), p_restrict: fields.get('restrict') === 'on' }, demo); await queue.refetch() } catch (caught) { setError(readableError(caught)) } finally { setBusy(false) }
  }}><b>{item.reason ?? item.kind} · {item.status}</b><small>Reference {item.id.slice(0, 8)}{item.person && ` · @${item.person.username}`}</small><p className="user-content">{item.details}</p><label><span>Response visible to requester</span><textarea name="response" required maxLength={2000} rows={3} /></label><fieldset className="radio-choices"><legend>Case status</legend>{['reviewing', 'resolved', ...(item.caseType === 'report' ? ['dismissed'] : [])].map((value) => <label key={value}><input type="radio" name="status" value={value} required defaultChecked={value === 'reviewing'} />{value}</label>)}</fieldset>{item.caseType === 'report' && <label className="check-label"><input type="checkbox" name="restrict" />Restrict reported account’s community access and end their relationships/challenges</label>}<button className="secondary-button" disabled={busy || offline}>{busy ? 'Saving…' : 'Save review'}</button></form>)}</div>
}
