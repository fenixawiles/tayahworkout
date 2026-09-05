import * as Dialog from '@radix-ui/react-dialog'
import { ArrowLeft, Check, Copy, Flag, Search, Shield, UserMinus, UserPlus, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Profile } from '../types'
import { communityRpc, readableError, type CommunityData, type Person, type Relationship } from '../lib/community'
import { ConfirmAction, type Confirmation } from './ConfirmAction'

export function FriendsView({ profile, data, demo, offline, onRefresh, onProfile, onChallenges }: {
  profile: Profile; data: CommunityData; demo: boolean; offline: boolean
  onRefresh: () => Promise<unknown>; onProfile: () => void; onChallenges: () => void
}) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<Person | null>(null)
  const [searched, setSearched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [person, setPerson] = useState<Person | null>(null)
  const [report, setReport] = useState(false)
  const [reason, setReason] = useState('harassment')
  const [details, setDetails] = useState('')
  const [alsoBlock, setAlsoBlock] = useState(true)
  const [confirm, setConfirm] = useState<Confirmation | null>(null)
  const friends = data.relationships.filter((r) => r.status === 'accepted')
  const incoming = data.relationships.filter((r) => r.status === 'pending' && r.incoming)
  const outgoing = data.relationships.filter((r) => r.status === 'pending' && !r.incoming)
  const relationship = person ? data.relationships.find((r) => r.person.id === person.id) : null
  const isBlocked = person && data.blocks.some((p) => p.id === person.id)

  useEffect(() => {
    const pop = (event: PopStateEvent) => {
      if (!event.state?.friendModal) setPerson(null)
      setReport(Boolean(event.state?.friendReport))
    }
    window.addEventListener('popstate', pop)
    return () => window.removeEventListener('popstate', pop)
  }, [])

  function showPerson(next: Person) {
    setPerson(next); setReport(false); setError(''); setNotice('')
    window.history.pushState({ ...window.history.state, friendModal: true }, '')
  }
  function closePerson() {
    if (window.history.state?.friendModal) window.history.back()
    else setPerson(null)
  }
  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true); setError(''); setNotice('')
    try { await action(); await onRefresh(); setNotice(message); return true } catch (caught) { setError(readableError(caught)); return false } finally { setBusy(false) }
  }
  const respond = (r: Relationship, action: string) => run(() => communityRpc('respond_friend_request', { p_request_id: r.id, p_action: action }, demo), action === 'accept' ? 'You’re now friends.' : 'Request updated.')
  const copyCode = async () => {
    try { await navigator.clipboard.writeText(profile.friendCode ?? ''); setNotice('Friend code copied.') } catch { setError('Could not copy. Select and copy your code below.') }
  }

  return <div className="community-page">
    <div className="identity-card"><span className="person-avatar">{profile.displayName[0]}</span><div><b>{profile.username ? `@${profile.username}` : 'Choose your username'}</b><small>{profile.username ? 'Share this code with someone you know' : 'A name your friends can find you by'}</small>{profile.friendCode && <code>{profile.friendCode.match(/.{1,4}/g)?.join('-')}</code>}</div>{profile.username ? <button className="icon-button" onClick={copyCode} aria-label="Copy friend code"><Copy /></button> : <button className="text-button" onClick={onProfile}>Set up</button>}</div>
    {demo && <p className="info-note">Preview only. Sign in to send real friend requests.</p>}
    {data.restricted && <p className="info-note">Community access is paused. You can still block people, leave challenges, and contact support.</p>}
    <form className="friend-search" onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setError(''); setSearched(false); setResult(null)
      try { setResult(await communityRpc('find_friend', { p_query: query }, demo) as unknown as Person | null); setSearched(true) } catch (caught) { setError(readableError(caught)) } finally { setBusy(false) }
    }}><label className="search-field"><Search aria-hidden="true" /><input aria-label="Exact username or friend code" value={query} onChange={(e) => { setQuery(e.target.value); setSearched(false); setResult(null) }} placeholder="Exact @username or friend code" autoCapitalize="none" autoCorrect="off" maxLength={26} /></label><button className="secondary-button" disabled={offline || busy || query.trim().length < 3 || data.restricted}>Find friend</button></form>
    <p className="field-help">Exact matches only. No public directory or email search.</p>
    {result && <button className="person-row search-result" onClick={() => showPerson(result)}><span className="person-avatar">{result.name[0]}</span><span><b>{result.name}</b><small>@{result.username}</small></span><UserPlus aria-hidden="true" /></button>}
    {searched && !result && <p className="info-note">No available match. Check the exact username or ask your friend for their code.</p>}
    {!person && error && <p role="alert" className="form-message error">{error}</p>}
    {!person && notice && <p role="status" className="form-message success">{notice}</p>}

    {incoming.length > 0 && <section className="community-group"><h2>Requests <span className="count-badge">{incoming.length}</span></h2>{incoming.map((r) => <div className="request-card" key={r.id}><button className="person-row" onClick={() => showPerson(r.person)}><span className="person-avatar">{r.person.name[0]}</span><span><b>{r.person.name}</b><small>@{r.person.username}</small></span></button><div className="inline-actions"><button className="secondary-button" disabled={busy || offline || data.restricted} onClick={() => void respond(r, 'accept')}><Check />Accept</button><button className="text-button" disabled={busy || offline} onClick={() => void respond(r, 'decline')}>Decline</button></div></div>)}</section>}
    <section className="community-group"><div className="section-heading"><h2>Your friends <span className="count-badge">{friends.length}</span></h2>{friends.length > 0 && <button className="text-button" onClick={onChallenges}>Challenges</button>}</div>
      {friends.length ? friends.map((r) => <button className="person-row" key={r.id} onClick={() => showPerson(r.person)}><span className="person-avatar">{r.person.name[0]}</span><span><b>{r.person.name}</b><small>@{r.person.username}</small></span><span className="row-status">Friend</span></button>) : <div className="calm-empty"><Users /><h3>A little company helps.</h3><p>Find someone you know and send a request. Your workout journal stays private.</p></div>}
    </section>
    {outgoing.length > 0 && <section className="community-group"><h2>Sent requests</h2>{outgoing.map((r) => <div className="person-row" key={r.id}><span><b>{r.person.name}</b><small>Waiting for @{r.person.username}</small></span><button className="text-button" disabled={busy || offline} onClick={() => void respond(r, 'cancel')}>Cancel</button></div>)}</section>}
    <details className="disclosure-card"><summary><Shield />Blocked accounts <span>{data.blocks.length}</span></summary><p>They can’t find you or send requests. Unblocking doesn’t restore a friendship.</p>{data.blocks.length ? data.blocks.map((p) => <button className="person-row" key={p.id} onClick={() => showPerson(p)}><span><b>{p.name}</b><small>@{p.username}</small></span><span className="row-status">Manage</span></button>) : <p>No blocked accounts.</p>}</details>
    {data.reports.length > 0 && <details className="disclosure-card"><summary><Flag />Your reports <span>{data.reports.length}</span></summary>{data.reports.map((r) => <div className="case-receipt" key={r.id}><b>{r.reason?.replaceAll('-', ' ')} · {r.status}</b><small>Reference {r.id.slice(0, 8)}</small>{r.response && <p>{r.response}</p>}</div>)}</details>}

    <Dialog.Root open={Boolean(person)} onOpenChange={(open) => { if (!open && !busy) closePerson() }}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="bottom-sheet person-sheet" aria-describedby="friend-privacy">
      <div className="sheet-handle" /><div className="sheet-heading"><Dialog.Title>{report ? 'Report account' : person?.name}</Dialog.Title><button className="icon-button" aria-label={report ? 'Back to friend' : 'Close friend'} onClick={closePerson} disabled={busy}>{report ? <ArrowLeft /> : <X />}</button></div>
      <p className="person-username">@{person?.username}</p><p className="field-help" id="friend-privacy">Friendship shares your name and username. Plans, reflections, photos, and health readings stay private.</p>
      {error && <p role="alert" className="form-message error">{error}</p>}{notice && <p role="status" className="form-message success">{notice}</p>}
      {report ? <form className="stack-form" onSubmit={async (event) => {
        event.preventDefault()
        const ok = await run(() => communityRpc('report_user', { p_user_id: person!.id, p_reason: reason, p_details: details, p_block: alsoBlock }, demo), 'Report received. Follow its status under Your reports. Reports are reviewed manually, not in real time.')
        if (ok) { setDetails(''); window.history.back() }
      }}><fieldset className="radio-choices"><legend>Why are you reporting this account?</legend>{[['harassment', 'Harassment or bullying'], ['impersonation', 'Impersonation'], ['spam', 'Spam or unwanted requests'], ['unsafe-content', 'Unsafe content'], ['other', 'Something else']].map(([value, label]) => <label key={value}><input type="radio" name="reportReason" checked={reason === value} onChange={() => setReason(value)} />{label}</label>)}</fieldset><label><span>What happened? <small>Optional</small></span><textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} rows={4} placeholder="Include enough context to help with review. Don’t include passwords or private health details." /></label><label className="check-label"><input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} />Also block this account</label><p className="field-help">Your report is private to the review team. This isn’t an emergency service.</p><button className="primary-button" disabled={busy || offline}>{busy ? 'Sending…' : 'Send report'}</button></form> : <div className="person-actions">
        {!relationship && !isBlocked && <button className="primary-button" disabled={busy || offline || !profile.username || data.restricted} onClick={() => void run(() => communityRpc('send_friend_request', { p_user_id: person!.id }, demo), 'Friend request sent.')}><UserPlus />{busy ? 'Sending…' : 'Send friend request'}</button>}
        {relationship?.status === 'pending' && <p className="info-note">{relationship.incoming ? 'This person sent you a friend request. Accept or decline it in your requests list.' : 'Your request is pending.'}</p>}
        {relationship?.status === 'accepted' && <button className="settings-row" disabled={offline} onClick={() => setConfirm({ title: `Remove ${person?.name}?`, description: 'This ends your friendship and shared challenges. They won’t be notified. A new request is needed to reconnect.', label: 'Remove friend', action: async () => { await communityRpc('respond_friend_request', { p_request_id: relationship.id, p_action: 'remove' }, demo); await onRefresh() } })}><UserMinus /><span><b>Remove friend</b></span></button>}
        <button className="settings-row" disabled={offline} onClick={() => setConfirm({ title: `${isBlocked ? 'Unblock' : 'Block'} ${person?.name}?`, description: isBlocked ? 'They can find your username again. Your old friendship and challenges won’t return.' : 'You’ll be hidden from each other, requests will stop, and shared challenges will end. They won’t be notified.', label: isBlocked ? 'Unblock account' : 'Block account', action: async () => { await communityRpc('set_user_block', { p_user_id: person!.id, p_blocked: !isBlocked }, demo); await onRefresh(); setResult(null) } })}><Shield /><span><b>{isBlocked ? 'Unblock account' : 'Block account'}</b></span></button>
        <button className="settings-row" disabled={offline} onClick={() => { setReport(true); setError(''); window.history.pushState({ ...window.history.state, friendReport: true }, '') }}><Flag /><span><b>Report account</b><small>Private, manually reviewed</small></span></button>
      </div>}
    </Dialog.Content></Dialog.Portal></Dialog.Root>
    <ConfirmAction value={confirm} onClose={() => setConfirm(null)} />
  </div>
}
