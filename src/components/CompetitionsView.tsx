import * as Dialog from '@radix-ui/react-dialog'
import { Check, Flag, Plus, X } from 'lucide-react'
import { addDays, format, parseISO } from 'date-fns'
import { useEffect, useState } from 'react'
import { communityRpc, competitionState, readableError, type CommunityData, type Competition } from '../lib/community'
import { ConfirmAction, type Confirmation } from './ConfirmAction'

export function CompetitionRules() {
  return <div className="challenge-rules"><b>Consistency, not intensity.</b><ul><li>One point per day when every exercise in that day’s saved plan is completed on time. Seven days means a maximum of seven points.</li><li>Each person follows their own saved timezone. Past days stay locked. Adding an unfinished exercise today removes today’s point until it’s done.</li><li>Only your name, username, and total score are shared. Rest when you need to; no streak penalty, cash prizes, or health-data scoring.</li><li>Results are self-reported. Ties are shared wins. Either person can leave; removing or blocking a friend ends the challenge.</li></ul></div>
}

export function CompetitionsView({ data, today, demo, offline, onRefresh, onFriends }: { data: CommunityData; today: string; demo: boolean; offline: boolean; onRefresh: () => Promise<unknown>; onFriends: () => void }) {
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('A little momentum')
  const [friendId, setFriendId] = useState('')
  const [startsOn, setStartsOn] = useState(format(addDays(parseISO(today), 1), 'yyyy-MM-dd'))
  const [days, setDays] = useState(7)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirm, setConfirm] = useState<Confirmation | null>(null)
  const friends = data.relationships.filter((r) => r.status === 'accepted')
  useEffect(() => {
    const pop = (e: PopStateEvent) => { if (!e.state?.challengeEditor) setCreating(false) }
    window.addEventListener('popstate', pop); return () => window.removeEventListener('popstate', pop)
  }, [])
  function close() { if (window.history.state?.challengeEditor) window.history.back(); else setCreating(false) }
  async function action(item: Competition, value: string) {
    await communityRpc('respond_competition', { p_competition_id: item.id, p_action: value }, demo)
    await onRefresh()
  }
  async function respond(item: Competition, value: string) {
    setBusy(true); setError('')
    try { await action(item, value); setNotice(value === 'accept' ? 'Challenge accepted. You’re in!' : 'Invitation declined.') } catch (caught) { setError(readableError(caught)) } finally { setBusy(false) }
  }
  return <div className="community-page">
    <p className="section-intro">A friendly nudge to show up. Invite one friend to a 7, 14, or 28-day challenge.</p>
    <button className="primary-button" disabled={offline || data.restricted} onClick={() => { if (!friends.length) { onFriends(); return }; setCreating(true); setError(''); setFriendId(friends[0].person.id); window.history.pushState({ ...window.history.state, challengeEditor: true }, '') }}><Plus />{friends.length ? 'Start a challenge' : 'Find a friend to challenge'}</button>
    {!creating && error && <p className="form-message error" role="alert">{error}</p>}{notice && <p className="form-message success" role="status">{notice}</p>}
    <div className="challenge-list">{data.competitions.map((item) => {
      const state = competitionState(item)
      const totalDays = Math.round((Date.parse(item.endsOn) - Date.parse(item.startsOn)) / 86400000) + 1
      const finished = state === 'Finished'
      const result = item.creatorScore === item.friendScore ? 'A shared win' : `${item.creatorScore > item.friendScore ? item.creator.name : item.friend.name} wins`
      return <article className="challenge-card" key={item.id}>
        <div className="challenge-card-top"><span className="status-pill">{state}</span><Flag aria-hidden="true" /></div><h2>{item.title}</h2><p className="challenge-dates">{format(parseISO(item.startsOn), 'MMM d')} – {format(parseISO(item.endsOn), 'MMM d, yyyy')} · {totalDays} days</p>
        <div className="challenge-scoreboard">{[[item.creator, item.creatorScore], [item.friend, item.friendScore]].map(([person, score]) => typeof person === 'object' && <div key={person.id}><span className="person-avatar">{person.name[0]}</span><b>{person.name}</b><small>@{person.username}</small><strong>{String(score)}<span> / {totalDays}</span></strong></div>)}</div>
        {finished && <p className="challenge-result">{result}. Every day you showed up counts.</p>}
        {state === 'In progress' && <p className="field-help">Today’s score can change until local midnight. Both timezones must finish before the result is final.</p>}
        {item.status === 'pending' && item.incoming && !item.expired && <><details className="disclosure-card"><summary>Review rules & privacy</summary><CompetitionRules /></details><div className="inline-actions"><button className="secondary-button" disabled={busy || offline || data.restricted} onClick={() => setConfirm({ title: 'Join this challenge?', description: 'You and this friend will see each other’s total completed-day scores for these dates. Your workout details stay private. By joining you agree to the rules shown here.', label: 'Accept challenge', action: async () => { await action(item, 'accept') } })}>Accept challenge</button><button className="text-button" disabled={busy || offline} onClick={() => void respond(item, 'decline')}>Decline</button></div></>}
        {['pending', 'accepted'].includes(item.status) && !finished && <button className="text-button" disabled={offline} onClick={() => setConfirm({ title: item.status === 'pending' ? 'Cancel this invitation?' : 'Leave this challenge?', description: 'The challenge will end for both of you. Neither person is recorded as a winner. Your workout progress is unchanged.', label: item.status === 'pending' ? 'Cancel invitation' : 'Leave challenge', action: () => action(item, 'leave') })}>{item.status === 'pending' ? 'Cancel invitation' : 'Leave challenge'}</button>}
      </article>
    })}</div>
    {!data.competitions.length && <div className="calm-empty"><Flag /><h3>Better together.</h3><p>Your invitations and challenges will appear here. A friend must accept before a challenge starts.</p></div>}
    <details className="disclosure-card"><summary>How scoring works</summary><CompetitionRules /></details>

    <Dialog.Root open={creating} onOpenChange={(open) => { if (!open && !busy) close() }}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="full-panel challenge-editor" aria-describedby="challenge-description">
      <div className="panel-topbar"><div><Dialog.Title>Start a challenge</Dialog.Title><Dialog.Description id="challenge-description">An invitation, never an obligation.</Dialog.Description></div><button className="icon-button" onClick={close} disabled={busy} aria-label="Close challenge editor"><X /></button></div>
      <form className="stack-form account-form" onSubmit={async (event) => {
        event.preventDefault(); setBusy(true); setError('')
        try { await communityRpc('create_competition', { p_friend_id: friendId, p_title: title, p_starts_on: startsOn, p_days: days }, demo); await onRefresh(); setNotice('Invitation sent. Your friend must accept before the start date.'); close() } catch (caught) { setError(readableError(caught)) } finally { setBusy(false) }
      }}><label><span>Challenge name</span><input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={60} /></label>
        <fieldset className="radio-choices"><legend>Invite a friend</legend>{friends.map((r) => <label key={r.id}><input type="radio" name="challengeFriend" checked={friendId === r.person.id} onChange={() => setFriendId(r.person.id)} />{r.person.name}<small>@{r.person.username}</small></label>)}</fieldset>
        <label><span>Starts on</span><input type="date" value={startsOn} min={format(addDays(parseISO(today), 1), 'yyyy-MM-dd')} max={format(addDays(parseISO(today), 30), 'yyyy-MM-dd')} onChange={(e) => setStartsOn(e.target.value)} required /></label><p className="field-help">Choose a future date in both people’s timezones. Accept before either person reaches that date.</p>
        <fieldset className="segmented-field"><legend>Duration</legend><div>{[7, 14, 28].map((n) => <button type="button" aria-pressed={days === n} className={days === n ? 'selected' : ''} key={n} onClick={() => setDays(n)}>{days === n && <Check />}{n} days</button>)}</div></fieldset>
        <CompetitionRules />{error && <p className="form-message error" role="alert">{error}</p>}
        <div className="editor-save-footer"><button className="primary-button" disabled={busy || offline || !friendId || !title.trim()}>{busy ? 'Sending invitation…' : 'Send invitation'}</button></div>
      </form>
    </Dialog.Content></Dialog.Portal></Dialog.Root>
    <ConfirmAction value={confirm} onClose={() => setConfirm(null)} />
  </div>
}
