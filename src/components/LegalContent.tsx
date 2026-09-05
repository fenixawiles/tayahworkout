export type LegalPage = 'privacy' | 'terms'

export function LegalContent({ page }: { page: LegalPage }) {
  return <article className="legal-content">
    <p className="legal-version">Updated September 5, 2026 · Momentum beta</p>
    {page === 'privacy' ? <>
      <p>Your workout journal is private. Adding a friend does not give them access to your exercises, photos, weights, reflections, or email address.</p>
      <h2>What Momentum stores</h2>
      <p>Account email and sign-in information; display name, optional username, stable account ID and friend code; your selected timezone; saved exercises and optional photos; plans, targets, notes, completion timestamps, and reflections. Social features store requests, friendships, blocks, challenge dates and scores. Support requests and reports store the information you submit and their review status.</p>
      <h2>Why it is used</h2>
      <p>To sign you in, synchronize your journal across devices, enforce local-day completion rules, calculate progress and challenge results, prevent unwanted contact, and handle support and safety reports. We do not sell your data, run advertising, or use your workouts for ad targeting.</p>
      <h2>What other people can see</h2>
      <p>Someone who knows your exact username or friend code can find your display name and username once you set one. There is no browsable directory or email search. Challenge participants see each other’s identity and total completed-day scores for the agreed dates. They do not see individual workout details. Blocked people are hidden from each other. Reports are visible only to their submitter and authorized reviewers, not the reported person.</p>
      <h2>Where information is processed</h2>
      <p>Supabase provides account authentication, database storage, and private photo storage. GitHub Pages hosts the application. These providers may process connection and security logs under their own policies. Photos use temporary access links. Access controls limit accounts to their own journal data, but no online service can promise absolute security.</p>
      <p><a href="https://supabase.com/privacy" target="_blank" rel="noreferrer">Supabase privacy policy</a> · <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noreferrer">GitHub privacy statement</a></p>
      <h2>Your device and notifications</h2>
      <p>Your browser stores a sign-in session and a local copy of your last synchronized workout journal for view-only access during connection loss. Signing out removes that account’s workout cache from this browser. Clear site data to remove all local copies. Do not stay signed in on a shared device. The installed app caches its shell and bundled exercise images; it does not allow offline workout edits.</p>
      <p>Account-access messages are sent through Supabase Auth. Optional workout reminder emails are not available until a delivery provider is configured. If enabled later, they require your opt-in, check unfinished planned workouts around 5pm in your saved timezone, and include an unsubscribe link. No reminder emails are sent for unplanned or already completed days.</p>
      <h2>Health and watch data</h2>
      <p>This web release does not connect to Samsung Health, Health Connect, or any watch. It does not collect steps, heart rate, sleep, or sensor readings. A future integration would require a separate explanation and permission before collecting anything.</p>
      <h2>Retention and your choices</h2>
      <p>Your saved journal stays with your account until deletion. Archived exercises may remain in old plans to preserve your history. Removing a friendship ends shared challenges; blocking also prevents future lookup and contact. You can change your profile, download your workout data, and submit privacy or account-deletion requests in More → Help & privacy requests. Deletion requests are handled manually; submitting one does not immediately delete the account. You can cancel an open request.</p>
      <p>Resolved support and safety records may be retained for up to 180 days for follow-up and abuse prevention; open investigations remain until handled. If the account is deleted, remaining safety records are detached from its profile. Delivery logs, when used, are retained for up to 90 days. Provider backups and security logs may expire on different schedules.</p>
      <h2>Questions and changes</h2>
      <p>Use More → Help & privacy requests to contact the independent operator privately and follow the response in the app. This beta does not yet publish a support email address. If you cannot sign in, use the account recovery flow; a separate unauthenticated contact channel is not available yet. Do not submit passwords or unnecessary medical information. Material changes to collection or sharing will be described before new permissions are requested.</p>
    </> : <>
      <p>Momentum is an independently operated workout-planning service in beta. These terms explain the basic ground rules for using it. They do not remove rights you have under applicable law.</p>
      <h2>Your account</h2>
      <p>Use an email address you control, keep your sign-in details private, and do not impersonate another person. Usernames are unique, are not proof of identity, and can be changed at most once every 30 days. Your stable account ID and friend code remain the same. Do not share an account or use another person’s credentials.</p>
      <h2>Fitness, not medical advice</h2>
      <p>Momentum helps organize exercises you choose. It does not prescribe treatment, diagnose conditions, monitor emergencies, or verify that an exercise is suitable for you. Choose activities and targets within your abilities. Stop if you feel unwell, and seek appropriate professional advice when needed. There is no obligation to exercise daily or keep up with another person.</p>
      <h2>Your content and privacy</h2>
      <p>You keep ownership of your uploaded photos, notes, and workout content. Upload only material you have permission to use. You allow Momentum and its hosting providers to store, process, and display that content as needed to provide the features you use. Do not upload illegal material, someone else’s private information without permission, or sensitive content unrelated to your workouts. See the Privacy policy for storage and sharing details.</p>
      <h2>Friends and community conduct</h2>
      <p>Send requests only to people you intend to connect with. Do not harass, threaten, bully, impersonate, spam, evade blocks, or automate account lookup. Respect a declined invitation. Reports are reviewed manually and are not an emergency channel. Community access may be restricted for abuse, with questions or appeals available through Help & privacy requests. Blocking and reporting remain available even when community access is restricted.</p>
      <h2>Challenge rules</h2>
      <p>Challenges are private, self-reported, and invitation-only. Both people agree to fixed dates and a 7, 14, or 28-day duration before starting. A fully completed, non-empty workout day earns one point, capped at one per day. Each exercise must be completed on its scheduled date in the participant’s saved timezone. Adding an unfinished exercise can reopen today’s workout and remove today’s point. Past plans cannot be edited.</p>
      <p>Only total scores and profile identity are shared. Ties are shared wins. Timezone changes are locked while accepted challenges remain unfinished and otherwise limited to once every 30 days to protect day-locking rules. Removing or blocking a friend or leaving a challenge ends it without declaring a winner. There are no cash prizes, wagers, medical guarantees, or independently verified performance claims.</p>
      <h2>Availability and account deletion</h2>
      <p>Features may change and the beta may have outages or errors. Keep an export of anything important. Offline journal access is view-only. You may stop using Momentum at any time, sign out, and request account deletion through More. Deletion is permanent once processed; an open request can be cancelled beforehand. Safety records may be retained as explained in the Privacy policy.</p>
      <h2>Contact and updates</h2>
      <p>Contact the operator through More → Help & privacy requests. Responses and request status appear in the app. There is no guaranteed response time. These terms may be updated as the service develops; the revision date above identifies this version. Nothing here promises healthcare compliance or replaces the operator’s obligations under applicable law.</p>
    </>}
  </article>
}
