create extension if not exists pgcrypto;

create type public.exercise_category as enum ('strength', 'bodyweight', 'cardio', 'mobility', 'recovery');
create type public.body_area as enum ('upper-body', 'lower-body', 'core', 'full-body');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  time_zone text not null default 'UTC' check (char_length(time_zone) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  category public.exercise_category not null,
  body_area public.body_area not null default 'full-body',
  equipment text not null default 'None' check (char_length(equipment) <= 80),
  default_target text not null default '' check (char_length(default_target) <= 100),
  image_path text,
  image_source text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.exercise_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

create table public.day_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_date date not null,
  title text not null default 'Workout day' check (char_length(title) between 1 and 100),
  reflection text not null default '' check (char_length(reflection) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, plan_date)
);

create table public.day_exercises (
  id uuid primary key default gen_random_uuid(),
  day_plan_id uuid not null references public.day_plans(id) on delete cascade,
  source_exercise_id uuid references public.exercises(id) on delete set null,
  name_snapshot text not null check (char_length(name_snapshot) between 1 and 100),
  category public.exercise_category not null,
  body_area_snapshot public.body_area not null default 'full-body',
  image_path_snapshot text,
  target text not null default '' check (char_length(target) <= 100),
  notes text not null default '' check (char_length(notes) <= 500),
  sort_order integer not null check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.exercise_completions (
  day_exercise_id uuid primary key references public.day_exercises(id) on delete cascade,
  completed_at timestamptz not null default now()
);

create table public.routine_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.routine_template_items (
  id uuid primary key default gen_random_uuid(),
  routine_template_id uuid not null references public.routine_templates(id) on delete cascade,
  source_exercise_id uuid references public.exercises(id) on delete set null,
  name_snapshot text not null check (char_length(name_snapshot) between 1 and 100),
  category public.exercise_category not null,
  body_area_snapshot public.body_area not null default 'full-body',
  image_path_snapshot text,
  target text not null default '' check (char_length(target) <= 100),
  notes text not null default '' check (char_length(notes) <= 500),
  sort_order integer not null check (sort_order >= 0)
);

create index day_plans_user_date_idx on public.day_plans (user_id, plan_date);
create index day_exercises_plan_order_idx on public.day_exercises (day_plan_id, sort_order);
create index routine_templates_user_idx on public.routine_templates (user_id, created_at);
create index exercises_owner_name_idx on public.exercises (owner_id, name);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger exercises_set_updated_at before update on public.exercises for each row execute function public.set_updated_at();
create trigger day_plans_set_updated_at before update on public.day_plans for each row execute function public.set_updated_at();
create trigger day_exercises_set_updated_at before update on public.day_exercises for each row execute function public.set_updated_at();
create trigger routine_templates_set_updated_at before update on public.routine_templates for each row execute function public.set_updated_at();

create function public.validate_profile_time_zone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.time_zone) then
    raise exception 'Unknown IANA timezone';
  end if;
  return new;
end;
$$;

create trigger profiles_validate_time_zone before insert or update on public.profiles for each row execute function public.validate_profile_time_zone();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, time_zone)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(coalesce(new.email, 'Friend'), '@', 1)),
    coalesce(nullif(new.raw_user_meta_data ->> 'time_zone', ''), 'UTC')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.current_user_date(p_user_id uuid default auth.uid())
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null or p_user_id <> auth.uid() then null
    else (now() at time zone coalesce((select p.time_zone from public.profiles p where p.id = p_user_id), 'UTC'))::date
  end;
$$;

alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_favorites enable row level security;
alter table public.day_plans enable row level security;
alter table public.day_exercises enable row level security;
alter table public.exercise_completions enable row level security;
alter table public.routine_templates enable row level security;
alter table public.routine_template_items enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy exercises_select_visible on public.exercises for select to authenticated using (owner_id is null or owner_id = auth.uid());
create policy exercises_insert_own on public.exercises for insert to authenticated with check (owner_id = auth.uid());
create policy exercises_update_own on public.exercises for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy favorites_all_own on public.exercise_favorites for all to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.exercises e
    where e.id = exercise_id and (e.owner_id is null or e.owner_id = auth.uid())
  )
);
create policy day_plans_select_own on public.day_plans for select to authenticated using (user_id = auth.uid());
create policy day_exercises_select_own on public.day_exercises for select to authenticated using (
  exists (select 1 from public.day_plans p where p.id = day_plan_id and p.user_id = auth.uid())
);
create policy completions_select_own on public.exercise_completions for select to authenticated using (
  exists (
    select 1 from public.day_exercises de
    join public.day_plans p on p.id = de.day_plan_id
    where de.id = day_exercise_id and p.user_id = auth.uid()
  )
);
create policy templates_all_own on public.routine_templates for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy template_items_all_own on public.routine_template_items for all to authenticated using (
  exists (select 1 from public.routine_templates t where t.id = routine_template_id and t.user_id = auth.uid())
) with check (
  exists (select 1 from public.routine_templates t where t.id = routine_template_id and t.user_id = auth.uid())
);

create function public.save_day_plan(p_plan_date date, p_title text, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan_id uuid;
  v_item jsonb;
  v_item_id uuid;
  v_ids uuid[];
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_plan_date < public.current_user_date(v_user_id) then raise exception 'Past workout days are read-only'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Add at least one exercise'; end if;
  if char_length(trim(coalesce(p_title, ''))) > 100 then raise exception 'Day name is too long'; end if;
  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    left join public.exercises e on e.id = nullif(item ->> 'source_exercise_id', '')::uuid
    where nullif(item ->> 'source_exercise_id', '') is not null
      and (e.id is null or (e.owner_id is not null and e.owner_id <> v_user_id))
  ) then raise exception 'Exercise is not available to this account'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) item
    where coalesce(item ->> 'image_path', '') <> ''
      and item ->> 'image_path' not like 'seed/%'
      and item ->> 'image_path' not like v_user_id::text || '/%'
  ) then raise exception 'Exercise image is not available to this account'; end if;
  insert into public.day_plans (user_id, plan_date, title)
  values (v_user_id, p_plan_date, coalesce(nullif(trim(p_title), ''), 'Workout day'))
  on conflict (user_id, plan_date) do update set title = excluded.title
  returning id into v_plan_id;

  select array_agg((value ->> 'id')::uuid) into v_ids from jsonb_array_elements(p_items);
  if exists (select 1 from public.day_exercises where id = any(v_ids) and day_plan_id <> v_plan_id) then
    raise exception 'One or more exercises do not belong to this workout day';
  end if;

  delete from public.day_exercises where day_plan_id = v_plan_id and not (id = any(v_ids));

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_item_id := (v_item ->> 'id')::uuid;
    insert into public.day_exercises (
      id, day_plan_id, source_exercise_id, name_snapshot, category, body_area_snapshot,
      image_path_snapshot, target, notes, sort_order
    ) values (
      v_item_id,
      v_plan_id,
      nullif(v_item ->> 'source_exercise_id', '')::uuid,
      left(trim(v_item ->> 'name'), 100),
      (v_item ->> 'category')::public.exercise_category,
      coalesce(nullif(v_item ->> 'body_area', '')::public.body_area, 'full-body'),
      nullif(v_item ->> 'image_path', ''),
      left(coalesce(v_item ->> 'target', ''), 100),
      left(coalesce(v_item ->> 'notes', ''), 500),
      (v_item ->> 'sort_order')::integer
    )
    on conflict (id) do update set
      source_exercise_id = excluded.source_exercise_id,
      name_snapshot = excluded.name_snapshot,
      category = excluded.category,
      body_area_snapshot = excluded.body_area_snapshot,
      image_path_snapshot = excluded.image_path_snapshot,
      target = excluded.target,
      notes = excluded.notes,
      sort_order = excluded.sort_order
    where public.day_exercises.day_plan_id = v_plan_id;
  end loop;

  return v_plan_id;
end;
$$;

create function public.set_exercise_completion(p_day_exercise_id uuid, p_completed boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan_date date;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select p.plan_date into v_plan_date
  from public.day_exercises de
  join public.day_plans p on p.id = de.day_plan_id
  where de.id = p_day_exercise_id and p.user_id = v_user_id;
  if v_plan_date is null then raise exception 'Exercise not found'; end if;
  if v_plan_date <> public.current_user_date(v_user_id) then raise exception 'Exercises can only be completed on their scheduled day'; end if;
  if p_completed then
    insert into public.exercise_completions (day_exercise_id, completed_at)
    values (p_day_exercise_id, now()) on conflict (day_exercise_id) do nothing;
  else
    delete from public.exercise_completions where day_exercise_id = p_day_exercise_id;
  end if;
end;
$$;

create function public.save_day_reflection(p_plan_date date, p_reflection text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_plan_date <> public.current_user_date(v_user_id) then raise exception 'Reflections can only be edited today'; end if;
  update public.day_plans set reflection = left(coalesce(p_reflection, ''), 1000)
  where user_id = v_user_id and plan_date = p_plan_date;
  if not found then raise exception 'Workout day not found'; end if;
end;
$$;

create function public.save_routine_template(p_name text, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_template_id uuid;
  v_item jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if trim(coalesce(p_name, '')) = '' then raise exception 'Routine name is required'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'A routine needs at least one exercise'; end if;
  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    left join public.exercises e on e.id = nullif(item ->> 'source_exercise_id', '')::uuid
    where nullif(item ->> 'source_exercise_id', '') is not null
      and (e.id is null or (e.owner_id is not null and e.owner_id <> v_user_id))
  ) then raise exception 'Exercise is not available to this account'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) item
    where coalesce(item ->> 'image_path', '') <> ''
      and item ->> 'image_path' not like 'seed/%'
      and item ->> 'image_path' not like v_user_id::text || '/%'
  ) then raise exception 'Exercise image is not available to this account'; end if;
  insert into public.routine_templates (user_id, name) values (v_user_id, left(trim(p_name), 100)) returning id into v_template_id;
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    insert into public.routine_template_items (
      routine_template_id, source_exercise_id, name_snapshot, category, body_area_snapshot,
      image_path_snapshot, target, notes, sort_order
    ) values (
      v_template_id,
      nullif(v_item ->> 'source_exercise_id', '')::uuid,
      left(trim(v_item ->> 'name'), 100),
      (v_item ->> 'category')::public.exercise_category,
      coalesce(nullif(v_item ->> 'body_area', '')::public.body_area, 'full-body'),
      nullif(v_item ->> 'image_path', ''),
      left(coalesce(v_item ->> 'target', ''), 100),
      left(coalesce(v_item ->> 'notes', ''), 500),
      (v_item ->> 'sort_order')::integer
    );
  end loop;
  return v_template_id;
end;
$$;

revoke all on function public.current_user_date(uuid) from public;
revoke all on function public.save_day_plan(date, text, jsonb) from public;
revoke all on function public.set_exercise_completion(uuid, boolean) from public;
revoke all on function public.save_day_reflection(date, text) from public;
revoke all on function public.save_routine_template(text, jsonb) from public;
grant execute on function public.current_user_date(uuid) to authenticated;
grant execute on function public.save_day_plan(date, text, jsonb) to authenticated;
grant execute on function public.set_exercise_completion(uuid, boolean) to authenticated;
grant execute on function public.save_day_reflection(date, text) to authenticated;
grant execute on function public.save_routine_template(text, jsonb) to authenticated;

revoke insert, update, delete on public.day_plans from anon, authenticated;
revoke insert, update, delete on public.day_exercises from anon, authenticated;
revoke insert, update, delete on public.exercise_completions from anon, authenticated;
revoke all on public.profiles, public.exercises, public.exercise_favorites, public.day_plans, public.day_exercises, public.exercise_completions, public.routine_templates, public.routine_template_items from anon;
grant select on public.profiles, public.exercises, public.exercise_favorites, public.day_plans, public.day_exercises, public.exercise_completions, public.routine_templates, public.routine_template_items to authenticated;
grant insert, update on public.profiles, public.exercises to authenticated;
grant insert, delete on public.exercise_favorites to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exercise-images', 'exercise-images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy exercise_images_select_own on storage.objects for select to authenticated using (
  bucket_id = 'exercise-images' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy exercise_images_insert_own on storage.objects for insert to authenticated with check (
  bucket_id = 'exercise-images' and (storage.foldername(name))[1] = auth.uid()::text
);
insert into public.exercises (id, owner_id, name, category, body_area, equipment, default_target, image_path, image_source) values
('00000000-0000-4000-8000-000000000001', null, 'Goblet squat', 'strength', 'lower-body', 'Kettlebell', '3 × 10', 'seed/goblet-squat.jpg', 'Free Exercise DB · Public Domain'),
('00000000-0000-4000-8000-000000000002', null, 'Romanian deadlift', 'strength', 'lower-body', 'Barbell', '3 × 10', 'seed/romanian-deadlift.jpg', 'Free Exercise DB · Public Domain'),
('00000000-0000-4000-8000-000000000003', null, 'Dumbbell bench press', 'strength', 'upper-body', 'Dumbbells', '3 × 10', 'seed/dumbbell-bench-press.jpg', 'Free Exercise DB · Public Domain'),
('00000000-0000-4000-8000-000000000004', null, 'One-arm dumbbell row', 'strength', 'upper-body', 'Dumbbell', '3 × 12', 'seed/one-arm-dumbbell-row.jpg', 'Free Exercise DB · Public Domain'),
('00000000-0000-4000-8000-000000000005', null, 'Seated dumbbell press', 'strength', 'upper-body', 'Dumbbells', '3 × 10', 'seed/seated-dumbbell-press.jpg', 'Free Exercise DB · Public Domain'),
('00000000-0000-4000-8000-000000000006', null, 'Dumbbell reverse lunge', 'strength', 'lower-body', 'Dumbbells', '3 × 8 each', 'seed/dumbbell-rear-lunge.jpg', 'Free Exercise DB · Public Domain'),
('00000000-0000-4000-8000-000000000007', null, 'Hip thrust', 'strength', 'lower-body', 'Barbell', '3 × 12', 'seed/barbell-hip-thrust.jpg', 'Free Exercise DB · Public Domain'),
('00000000-0000-4000-8000-000000000008', null, 'Dumbbell curl', 'strength', 'upper-body', 'Dumbbells', '3 × 12', 'seed/dumbbell-bicep-curl.jpg', 'Free Exercise DB · Public Domain'),
('00000000-0000-4000-8000-000000000009', null, 'Triceps extension', 'strength', 'upper-body', 'Dumbbell', '3 × 12', 'seed/dumbbell-triceps-extension.jpg', 'Free Exercise DB · Public Domain'),
('00000000-0000-4000-8000-000000000010', null, 'Standing calf raise', 'strength', 'lower-body', 'Bodyweight', '3 × 15', 'seed/standing-calf-raise.jpg', 'Free Exercise DB · Public Domain'),
('00000000-0000-4000-8000-000000000011', null, 'Bodyweight squat', 'bodyweight', 'lower-body', 'None', '3 × 15', 'seed/bodyweight-squat.jpg', 'Free Exercise DB · Public Domain'),
('00000000-0000-4000-8000-000000000012', null, 'Incline push-up', 'bodyweight', 'upper-body', 'Bench', '3 × 10', 'seed/incline-push-up.jpg', 'Free Exercise DB · Public Domain'),
('00000000-0000-4000-8000-000000000013', null, 'Glute bridge', 'bodyweight', 'lower-body', 'None', '3 × 15', 'seed/glute-bridge.jpg', 'Free Exercise DB · Public Domain'),
('00000000-0000-4000-8000-000000000014', null, 'Dead bug', 'bodyweight', 'core', 'None', '3 × 8 each', 'seed/dead-bug.jpg', 'Free Exercise DB · Public Domain'),
('00000000-0000-4000-8000-000000000015', null, 'Plank', 'bodyweight', 'core', 'None', '3 × 30 sec', 'seed/plank.jpg', 'Free Exercise DB · Public Domain'),
('00000000-0000-4000-8000-000000000016', null, 'Mountain climbers', 'bodyweight', 'full-body', 'None', '3 × 30 sec', 'seed/mountain-climbers.jpg', 'Free Exercise DB · Public Domain'),
('00000000-0000-4000-8000-000000000017', null, 'Air bike', 'cardio', 'full-body', 'None', '3 × 30 sec', 'seed/air-bike.jpg', 'Free Exercise DB · Public Domain'),
('00000000-0000-4000-8000-000000000018', null, 'Stationary bike', 'cardio', 'lower-body', 'Bike', '20 minutes', 'seed/stationary-bike.jpg', 'Free Exercise DB · Public Domain'),
('00000000-0000-4000-8000-000000000019', null, 'Jump rope', 'cardio', 'full-body', 'Jump rope', '10 minutes', 'seed/rope-jumping.jpg', 'Free Exercise DB · Public Domain'),
('00000000-0000-4000-8000-000000000020', null, 'Treadmill jog', 'cardio', 'lower-body', 'Treadmill', '20 minutes', 'seed/jogging-treadmill.jpg', 'Free Exercise DB · Public Domain'),
('00000000-0000-4000-8000-000000000021', null, 'Hamstring stretch', 'mobility', 'lower-body', 'None', '45 sec each', 'seed/hamstring-stretch.jpg', 'Free Exercise DB · Public Domain'),
('00000000-0000-4000-8000-000000000022', null, 'Kneeling hip flexor stretch', 'mobility', 'lower-body', 'None', '45 sec each', 'seed/kneeling-hip-flexor.jpg', 'Free Exercise DB · Public Domain'),
('00000000-0000-4000-8000-000000000023', null, 'Cat stretch', 'mobility', 'full-body', 'None', '8 slow reps', 'seed/cat-stretch.jpg', 'Free Exercise DB · Public Domain'),
('00000000-0000-4000-8000-000000000024', null, 'Child’s pose', 'recovery', 'full-body', 'None', '2 minutes', 'seed/childs-pose.jpg', 'Free Exercise DB · Public Domain');
