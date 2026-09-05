create table public.app_capabilities (
  id boolean primary key default true check (id),
  email_reminders_ready boolean not null default false,
  account_deletion_ready boolean not null default false
);
insert into public.app_capabilities (id) values (true);

create table public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  workout_reminder_enabled boolean not null default false,
  consented_at timestamptz,
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  updated_at timestamptz not null default now()
);

create table public.reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  local_date date not null,
  status text not null default 'processing' check (status in ('processing', 'sent', 'failed', 'skipped')),
  attempts integer not null default 1,
  claim_token uuid not null default gen_random_uuid(),
  lease_until timestamptz not null default now() + interval '10 minutes',
  sent_at timestamptz,
  provider_message_id text,
  error_code text,
  created_at timestamptz not null default now(),
  unique (user_id, local_date)
);

do $$ declare t text; begin
  foreach t in array array['app_capabilities', 'notification_preferences', 'reminder_deliveries'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

create function public.get_account_settings() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in to continue'; end if;
  return jsonb_build_object(
    'reminderEnabled', coalesce((select workout_reminder_enabled from public.notification_preferences where user_id = auth.uid()), false),
    'remindersReady', coalesce((select email_reminders_ready from public.app_capabilities where id), false),
    'deletionReady', coalesce((select account_deletion_ready from public.app_capabilities where id), false));
end $$;

create function public.set_workout_reminder(p_enabled boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in to continue'; end if;
  if p_enabled and not exists (select 1 from public.app_capabilities where email_reminders_ready) then
    raise exception 'Email delivery is not set up yet. Please check back before enabling reminders.';
  end if;
  insert into public.notification_preferences (user_id, workout_reminder_enabled, consented_at)
    values (auth.uid(), p_enabled, case when p_enabled then now() else null end)
  on conflict (user_id) do update set workout_reminder_enabled = excluded.workout_reminder_enabled,
    consented_at = case when p_enabled then now() else public.notification_preferences.consented_at end, updated_at = now();
end $$;

-- Internal predicate with injectable clock for DST/midnight tests; never exposed to clients.
create function public.reminder_is_due(p_user uuid, p_now timestamptz) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p
    join public.notification_preferences n on n.user_id = p.id and n.workout_reminder_enabled
    join auth.users u on u.id = p.id and u.email_confirmed_at is not null and u.email is not null
    join public.day_plans d on d.user_id = p.id and d.plan_date = (p_now at time zone p.time_zone)::date
    where p.id = p_user and (u.banned_until is null or u.banned_until < p_now)
      and (p_now at time zone p.time_zone)::time >= time '17:00' and (p_now at time zone p.time_zone)::time < time '18:00'
      and exists (select 1 from public.day_exercises e left join public.exercise_completions c on c.day_exercise_id = e.id
        where e.day_plan_id = d.id and c.completed_at is null));
$$;

-- SKIP LOCKED plus a lease prevents concurrent workers from sending the same reminder.
-- Retries are confined to the same 5–6pm local window and one daily idempotency key.
create function public.claim_workout_reminders(p_limit integer default 50) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if not exists (select 1 from public.app_capabilities where email_reminders_ready) then return '[]'::jsonb; end if;
  insert into public.reminder_deliveries (user_id, local_date, status, attempts, lease_until)
    select p.id, (now() at time zone p.time_zone)::date, 'failed', 0, now() from public.profiles p
    where public.reminder_is_due(p.id, now())
    on conflict (user_id, local_date) do nothing;
  with candidates as (
    select d.id from public.reminder_deliveries d join public.profiles p on p.id = d.user_id
    where d.status in ('processing', 'failed') and d.lease_until <= now() and d.attempts < 3
      and d.local_date = (now() at time zone p.time_zone)::date and public.reminder_is_due(d.user_id, now())
    order by d.created_at for update of d skip locked limit least(greatest(p_limit, 1), 100)
  ), claimed as (
    update public.reminder_deliveries d set status = 'processing', attempts = attempts + 1, claim_token = gen_random_uuid(), lease_until = now() + interval '10 minutes'
    from candidates c where d.id = c.id returning d.id, d.claim_token
  ) select coalesce(jsonb_agg(to_jsonb(claimed)), '[]'::jsonb) into result from claimed;
  return result;
end $$;

create function public.get_workout_reminder_payload(p_id uuid, p_claim_token uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', d.id, 'email', u.email, 'localDate', d.local_date, 'unsubscribeToken', n.unsubscribe_token)
  from public.reminder_deliveries d join auth.users u on u.id = d.user_id
    join public.profiles p on p.id = d.user_id join public.notification_preferences n on n.user_id = d.user_id
  where d.id = p_id and d.claim_token = p_claim_token and d.status = 'processing' and d.lease_until > now()
    and d.local_date = (now() at time zone p.time_zone)::date and public.reminder_is_due(d.user_id, now())
    and exists (select 1 from public.app_capabilities where email_reminders_ready);
$$;

create function public.finish_workout_reminder(p_id uuid, p_claim_token uuid, p_status text, p_provider_id text default null, p_error_code text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('sent', 'failed', 'skipped') then raise exception 'Invalid delivery result'; end if;
  update public.reminder_deliveries set status = p_status, provider_message_id = p_provider_id,
    error_code = left(p_error_code, 80), sent_at = case when p_status = 'sent' then now() else null end,
    lease_until = now() + interval '10 minutes'
  where id = p_id and claim_token = p_claim_token and status = 'processing';
end $$;

create function public.unsubscribe_workout_reminders(p_token uuid) returns void
language sql security definer set search_path = '' as $$
  update public.notification_preferences set workout_reminder_enabled = false, updated_at = now() where unsubscribe_token = p_token;
$$;

-- Retention jobs can run with the reminder scheduler, with or without email enabled.
create function public.prune_community_delivery_logs() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.community_rate_limits where period < now() - interval '2 days';
  delete from public.reminder_deliveries where created_at < now() - interval '90 days';
  delete from public.user_reports where status in ('resolved', 'dismissed') and updated_at < now() - interval '180 days';
  delete from public.support_requests where status in ('resolved', 'cancelled') and updated_at < now() - interval '180 days';
end $$;

do $$ declare f text; begin
  foreach f in array array['get_account_settings()', 'set_workout_reminder(boolean)'] loop
    execute 'revoke all on function public.' || f || ' from public, anon, authenticated';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
  foreach f in array array['reminder_is_due(uuid,timestamptz)', 'claim_workout_reminders(integer)', 'get_workout_reminder_payload(uuid,uuid)', 'finish_workout_reminder(uuid,uuid,text,text,text)', 'unsubscribe_workout_reminders(uuid)', 'prune_community_delivery_logs()'] loop
    execute 'revoke all on function public.' || f || ' from public, anon, authenticated';
    execute 'grant execute on function public.' || f || ' to service_role';
  end loop;
end $$;
