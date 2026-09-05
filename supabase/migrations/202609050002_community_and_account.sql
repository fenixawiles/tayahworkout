-- Private, mutually accepted relationships. No public profile directory.
alter table public.profiles
  add column username text unique check (username is null or username ~ '^[a-z][a-z0-9_]{2,23}$'),
  add column friend_code text not null default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)) unique,
  add column username_changed_at timestamptz,
  add column timezone_changed_at timestamptz;

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> recipient_id)
);
create unique index friendships_pair on public.friendships (least(requester_id, recipient_id), greatest(requester_id, recipient_id));
create index friendships_recipient on public.friendships (recipient_id, status);
create index friendships_requester on public.friendships (requester_id, status);

create table public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 60),
  starts_on date not null,
  ends_on date not null,
  creator_timezone text not null,
  friend_timezone text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  rule_version integer not null default 1 check (rule_version = 1),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  updated_at timestamptz not null default now(),
  check (creator_id <> friend_id),
  check (ends_on - starts_on in (6, 13, 27))
);
create index competitions_creator on public.competitions (creator_id, ends_on);
create index competitions_friend on public.competitions (friend_id, ends_on);

create table public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  reported_id uuid references public.profiles(id) on delete set null,
  reason text not null check (reason in ('harassment', 'impersonation', 'spam', 'unsafe-content', 'other')),
  details text not null default '' check (char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  response text not null default '' check (char_length(response) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reporter_id is distinct from reported_id)
);
create index user_reports_queue on public.user_reports (status, created_at);

create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('support', 'privacy', 'delete-account')),
  details text not null check (char_length(trim(details)) between 1 and 2000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'cancelled')),
  response text not null default '' check (char_length(response) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Only the service role can appoint moderators. User metadata is never trusted.
create table public.community_moderators (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.community_restrictions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  reason text not null default 'Community access is paused. Contact support in More.',
  created_at timestamptz not null default now()
);
create table public.community_rate_limits (
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  period timestamptz not null,
  count integer not null,
  primary key (user_id, action, period)
);

-- RPC-only access: RLS is also enabled as defence in depth.
do $$ declare t text; begin
  foreach t in array array['friendships', 'user_blocks', 'competitions', 'user_reports', 'support_requests', 'community_moderators', 'community_restrictions', 'community_rate_limits'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

create function public.community_actor() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception 'Sign in to continue'; end if;
  if exists (select 1 from public.community_restrictions where user_id = actor) then
    raise exception 'Community access is paused. Contact support in More.';
  end if;
  return actor;
end $$;

create function public.community_limit(p_action text, p_max integer) returns void
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'Sign in to continue'; end if;
  insert into public.community_rate_limits (user_id, action, period, count)
  values (auth.uid(), p_action, date_trunc('day', now() at time zone 'UTC') at time zone 'UTC', 1)
  on conflict (user_id, action, period) do update set count = public.community_rate_limits.count + 1
  returning count into n;
  if n > p_max then raise exception 'Daily limit reached. Please try again tomorrow.'; end if;
end $$;

create function public.users_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

create function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select not public.users_blocked(a, b) and exists (
    select 1 from public.friendships where status = 'accepted'
      and least(requester_id, recipient_id) = least(a, b) and greatest(requester_id, recipient_id) = greatest(a, b)
  );
$$;

-- Small public identity only. Never returns email, timezone, plans, or health data.
create function public.community_identity(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', id, 'name', display_name, 'username', username, 'code', friend_code) from public.profiles where id = p_id;
$$;

create function public.update_profile(p_display_name text, p_time_zone text, p_username text) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); previous public.profiles; handle text := nullif(lower(trim(leading '@' from trim(p_username))), '');
begin
  if actor is null then raise exception 'Sign in to continue'; end if;
  select * into previous from public.profiles where id = actor for update;
  if char_length(trim(p_display_name)) not between 1 and 60 then raise exception 'Name must be 1–60 characters'; end if;
  if handle is not null and (handle !~ '^[a-z][a-z0-9_]{2,23}$' or handle in ('admin','administrator','moderator','momentum','support','help','official','security','privacy','deleted','system')) then
    raise exception 'Choose a username of 3–24 letters, numbers, or underscores, beginning with a letter';
  end if;
  if previous.username is not null and handle is null then raise exception 'Choose a username instead of clearing it'; end if;
  if handle is distinct from previous.username and previous.username_changed_at > now() - interval '30 days' then
    raise exception 'You can change your username once every 30 days';
  end if;
  if p_time_zone <> previous.time_zone then
    if previous.timezone_changed_at > now() - interval '30 days' then raise exception 'You can change your workout timezone once every 30 days'; end if;
    if exists (select 1 from public.competitions c where actor in (creator_id, friend_id) and status = 'accepted'
      and ends_on >= (now() at time zone previous.time_zone)::date) then raise exception 'Your timezone stays fixed until your accepted challenges finish or you leave them'; end if;
  end if;
  update public.profiles set display_name = trim(p_display_name), time_zone = p_time_zone, username = handle,
    username_changed_at = case when handle is distinct from previous.username then now() else username_changed_at end,
    timezone_changed_at = case when p_time_zone <> previous.time_zone then now() else timezone_changed_at end
  where id = actor;
exception when unique_violation then raise exception 'That username is already taken';
end $$;
revoke insert, update, delete on public.profiles from authenticated;

create function public.find_friend(p_query text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.community_actor(); target uuid; q text := trim(leading '@' from trim(p_query));
begin
  perform public.community_limit('lookup', 60);
  if char_length(q) not between 3 and 24 then return null; end if;
  select id into target from public.profiles p
  where (username = lower(q) or friend_code = upper(replace(q, '-', ''))) and id <> actor and username is not null
    and not public.users_blocked(actor, id)
    and not exists (select 1 from public.community_restrictions r where r.user_id = p.id);
  if target is null then return null; end if;
  return public.community_identity(target);
end $$;

create function public.send_friend_request(p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.community_actor(); existing public.friendships;
begin
  perform public.community_limit('friend-request', 10);
  if p_user_id = actor or public.users_blocked(actor, p_user_id) or not exists (select 1 from public.profiles where id = p_user_id and username is not null)
    or exists (select 1 from public.community_restrictions where user_id = p_user_id) then raise exception 'This person is not available'; end if;
  if not exists (select 1 from public.profiles where id = actor and username is not null) then raise exception 'Choose your username in Profile first'; end if;
  perform pg_advisory_xact_lock(hashtextextended(least(actor, p_user_id)::text || greatest(actor, p_user_id)::text, 0));
  select * into existing from public.friendships where least(requester_id, recipient_id) = least(actor, p_user_id) and greatest(requester_id, recipient_id) = greatest(actor, p_user_id) for update;
  if existing.status in ('pending', 'accepted') then raise exception 'A request or friendship already exists'; end if;
  if existing.updated_at > now() - interval '7 days' then raise exception 'Please wait seven days before sending another request to this person'; end if;
  if existing.id is not null then
    update public.friendships set requester_id = actor, recipient_id = p_user_id, status = 'pending', created_at = now(), updated_at = now() where id = existing.id;
  else insert into public.friendships (requester_id, recipient_id) values (actor, p_user_id); end if;
end $$;

create function public.respond_friend_request(p_request_id uuid, p_action text) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); item public.friendships;
begin
  if actor is null then raise exception 'Sign in to continue'; end if;
  select * into item from public.friendships where id = p_request_id and actor in (requester_id, recipient_id) for update;
  if item.id is null then raise exception 'Request not found'; end if;
  if p_action in ('accept', 'decline') and item.recipient_id = actor and item.status = 'pending' then
    if p_action = 'accept' then perform public.community_actor(); end if;
    if public.users_blocked(item.requester_id, item.recipient_id) or exists (select 1 from public.community_restrictions where user_id = item.requester_id) then raise exception 'Request not available'; end if;
    update public.friendships set status = case when p_action = 'accept' then 'accepted' else 'declined' end, updated_at = now() where id = item.id;
  elsif (p_action = 'cancel' and item.requester_id = actor and item.status = 'pending') or (p_action = 'remove' and item.status = 'accepted') then
    update public.friendships set status = 'cancelled', updated_at = now() where id = item.id;
    update public.competitions set status = 'cancelled', updated_at = now() where status in ('pending', 'accepted')
      and least(creator_id, friend_id) = least(item.requester_id, item.recipient_id) and greatest(creator_id, friend_id) = greatest(item.requester_id, item.recipient_id);
  else raise exception 'That action is not available for this request'; end if;
end $$;

create function public.set_user_block(p_user_id uuid, p_blocked boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null or actor = p_user_id then raise exception 'Choose another person'; end if;
  if p_blocked then
    insert into public.user_blocks (blocker_id, blocked_id) values (actor, p_user_id) on conflict do nothing;
    update public.friendships set status = 'cancelled', updated_at = now()
      where least(requester_id, recipient_id) = least(actor, p_user_id) and greatest(requester_id, recipient_id) = greatest(actor, p_user_id);
    update public.competitions set status = 'cancelled', updated_at = now()
      where least(creator_id, friend_id) = least(actor, p_user_id) and greatest(creator_id, friend_id) = greatest(actor, p_user_id);
  else delete from public.user_blocks where blocker_id = actor and blocked_id = p_user_id; end if;
end $$;

create function public.report_user(p_user_id uuid, p_reason text, p_details text, p_block boolean default true) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); result uuid;
begin
  if actor is null or actor = p_user_id then raise exception 'Choose another person'; end if;
  perform public.community_limit('report', 5);
  if not exists (select 1 from public.profiles where id = p_user_id) then raise exception 'Person not found'; end if;
  insert into public.user_reports (reporter_id, reported_id, reason, details) values (actor, p_user_id, p_reason, trim(p_details)) returning id into result;
  if p_block then perform public.set_user_block(p_user_id, true); end if;
  return result;
end $$;

create function public.create_competition(p_friend_id uuid, p_title text, p_starts_on date, p_days integer) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := public.community_actor(); my_zone text; their_zone text; result uuid;
begin
  perform public.community_limit('challenge', 5);
  if not public.are_friends(actor, p_friend_id) then raise exception 'Challenges are for accepted friends only'; end if;
  if exists (select 1 from public.community_restrictions where user_id = p_friend_id) then raise exception 'This person is not available'; end if;
  select time_zone into my_zone from public.profiles where id = actor;
  select time_zone into their_zone from public.profiles where id = p_friend_id;
  if p_days not in (7, 14, 28) or p_starts_on is null or p_starts_on <= greatest((now() at time zone my_zone)::date, (now() at time zone their_zone)::date)
    or p_starts_on > (now() at time zone my_zone)::date + 30 then raise exception 'Choose 7, 14, or 28 days, starting tomorrow or within the next 30 days in both timezones'; end if;
  if exists (select 1 from public.competitions where status in ('pending', 'accepted') and ends_on >= (now() at time zone my_zone)::date
    and least(creator_id, friend_id) = least(actor, p_friend_id) and greatest(creator_id, friend_id) = greatest(actor, p_friend_id)) then raise exception 'You already have an upcoming or active challenge together'; end if;
  insert into public.competitions (creator_id, friend_id, title, starts_on, ends_on, creator_timezone, friend_timezone)
    values (actor, p_friend_id, trim(p_title), p_starts_on, p_starts_on + p_days - 1, my_zone, their_zone) returning id into result;
  return result;
end $$;

create function public.respond_competition(p_competition_id uuid, p_action text) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); item public.competitions; my_zone text; their_zone text;
begin
  if actor is null then raise exception 'Sign in to continue'; end if;
  select * into item from public.competitions where id = p_competition_id and actor in (creator_id, friend_id) for update;
  if item.id is null then raise exception 'Challenge not found'; end if;
  if p_action in ('accept', 'decline') and item.friend_id = actor and item.status = 'pending' then
    if p_action = 'accept' then
      perform public.community_actor();
      if not public.are_friends(item.creator_id, item.friend_id) or exists (select 1 from public.community_restrictions where user_id = item.creator_id) then raise exception 'This invitation is no longer available'; end if;
      select time_zone into my_zone from public.profiles where id = item.creator_id;
      select time_zone into their_zone from public.profiles where id = item.friend_id;
      if item.starts_on <= greatest((now() at time zone my_zone)::date, (now() at time zone their_zone)::date) then raise exception 'This invitation has expired. Ask your friend for a new challenge'; end if;
      update public.competitions set status = 'accepted', accepted_at = now(), creator_timezone = my_zone, friend_timezone = their_zone, updated_at = now() where id = item.id;
    else update public.competitions set status = 'declined', updated_at = now() where id = item.id; end if;
  elsif p_action = 'leave' and item.status in ('pending', 'accepted') then
    update public.competitions set status = 'cancelled', updated_at = now() where id = item.id;
  else raise exception 'That challenge action is not available'; end if;
end $$;

-- Aggregate-only scoring: no client-written scores, no workout details shared.
create function public.competition_score(p_user uuid, p_start date, p_end date, p_zone text) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.day_plans p where p.user_id = p_user and p.plan_date between p_start and p_end
    and p.plan_date <= (now() at time zone p_zone)::date
    and exists (select 1 from public.day_exercises e where e.day_plan_id = p.id)
    and not exists (select 1 from public.day_exercises e left join public.exercise_completions c on c.day_exercise_id = e.id
      where e.day_plan_id = p.id and (c.completed_at is null or (c.completed_at at time zone p_zone)::date <> p.plan_date));
$$;

create function public.get_community() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := auth.uid(); relationships jsonb; challenges jsonb;
begin
  if actor is null then raise exception 'Sign in to continue'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'status', f.status, 'incoming', f.recipient_id = actor,
    'person', public.community_identity(case when f.requester_id = actor then f.recipient_id else f.requester_id end)) order by f.updated_at desc), '[]'::jsonb)
    into relationships from public.friendships f where actor in (requester_id, recipient_id) and status in ('pending', 'accepted') and not public.users_blocked(requester_id, recipient_id);
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'startsOn', c.starts_on, 'endsOn', c.ends_on, 'status', c.status,
    'incoming', friend_id = actor, 'creator', public.community_identity(creator_id), 'friend', public.community_identity(friend_id),
    'creatorScore', case when status = 'accepted' then public.competition_score(creator_id, starts_on, ends_on, creator_timezone) else 0 end,
    'friendScore', case when status = 'accepted' then public.competition_score(friend_id, starts_on, ends_on, friend_timezone) else 0 end,
    'creatorToday', (now() at time zone creator_timezone)::date, 'friendToday', (now() at time zone friend_timezone)::date,
    'expired', status = 'pending' and starts_on <= greatest((now() at time zone creator_timezone)::date, (now() at time zone friend_timezone)::date)
    ) order by c.created_at desc), '[]'::jsonb) into challenges
    from public.competitions c where actor in (creator_id, friend_id) and not public.users_blocked(creator_id, friend_id);
  return jsonb_build_object('relationships', relationships, 'competitions', challenges,
    'blocks', coalesce((select jsonb_agg(public.community_identity(blocked_id)) from public.user_blocks where blocker_id = actor), '[]'::jsonb),
    'reports', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'reason', reason, 'status', status, 'response', response, 'createdAt', created_at) order by created_at desc) from public.user_reports where reporter_id = actor), '[]'::jsonb),
    'requests', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'status', status, 'response', response, 'createdAt', created_at) order by created_at desc) from public.support_requests where user_id = actor), '[]'::jsonb),
    'restricted', exists (select 1 from public.community_restrictions where user_id = actor),
    'isModerator', exists (select 1 from public.community_moderators where user_id = actor));
end $$;

create function public.submit_support_request(p_kind text, p_details text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to continue'; end if;
  perform public.community_limit('support', 5);
  if exists (select 1 from public.support_requests where user_id = auth.uid() and kind = p_kind and status in ('open','reviewing')) then raise exception 'You already have an open request of this type. You can follow its status below'; end if;
  insert into public.support_requests (user_id, kind, details) values (auth.uid(), p_kind, trim(p_details)) returning id into result;
  return result;
end $$;

create function public.cancel_support_request(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in to continue'; end if;
  update public.support_requests set status = 'cancelled', updated_at = now() where id = p_id and user_id = auth.uid() and status in ('open', 'reviewing');
  if not found then raise exception 'Request is no longer open'; end if;
end $$;

create function public.get_moderation_queue() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.community_moderators where user_id = auth.uid()) then raise exception 'Moderator access required'; end if;
  return jsonb_build_object(
    'reports', coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object('person', public.community_identity(reported_id))) from public.user_reports r where status in ('open','reviewing')), '[]'::jsonb),
    'requests', coalesce((select jsonb_agg(to_jsonb(r)) from public.support_requests r where status in ('open','reviewing')), '[]'::jsonb));
end $$;

create function public.review_community_case(p_id uuid, p_kind text, p_status text, p_response text, p_restrict boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  if not exists (select 1 from public.community_moderators where user_id = auth.uid()) then raise exception 'Moderator access required'; end if;
  if p_kind = 'report' then
    update public.user_reports set status = p_status, response = trim(p_response), updated_at = now() where id = p_id returning reported_id into target;
    if not found then raise exception 'Report not found'; end if;
    if p_restrict and target is not null then
      insert into public.community_restrictions (user_id) values (target) on conflict do nothing;
      update public.friendships set status = 'cancelled', updated_at = now() where target in (requester_id, recipient_id);
      update public.competitions set status = 'cancelled', updated_at = now() where target in (creator_id, friend_id);
    end if;
  elsif p_kind = 'request' then
    if p_restrict then raise exception 'Restrictions require a report'; end if;
    update public.support_requests set status = p_status, response = trim(p_response), updated_at = now() where id = p_id;
    if not found then raise exception 'Request not found'; end if;
  else raise exception 'Unknown case type'; end if;
end $$;

-- Never grant helpers capable of arbitrary-user lookups or scoring.
do $$ declare f text; begin
  foreach f in array array['community_actor()', 'community_limit(text,integer)', 'users_blocked(uuid,uuid)', 'are_friends(uuid,uuid)', 'community_identity(uuid)', 'competition_score(uuid,date,date,text)'] loop
    execute 'revoke all on function public.' || f || ' from public, anon, authenticated';
  end loop;
  foreach f in array array['update_profile(text,text,text)', 'find_friend(text)', 'send_friend_request(uuid)', 'respond_friend_request(uuid,text)', 'set_user_block(uuid,boolean)', 'report_user(uuid,text,text,boolean)', 'create_competition(uuid,text,date,integer)', 'respond_competition(uuid,text)', 'get_community()', 'submit_support_request(text,text)', 'cancel_support_request(uuid)', 'get_moderation_queue()', 'review_community_case(uuid,text,text,text,boolean)'] loop
    execute 'revoke all on function public.' || f || ' from public, anon, authenticated';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;
