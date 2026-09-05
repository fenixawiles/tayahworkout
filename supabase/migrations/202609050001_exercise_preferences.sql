-- Personal defaults for both shared and custom exercises. Saved plans remain snapshots.
create table public.exercise_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  target text not null default '' check (char_length(target) <= 80),
  weight numeric(7, 2) check (weight > 0 and weight <= 10000),
  weight_unit text not null default 'lb' check (weight_unit in ('lb', 'kg')),
  updated_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

create index exercise_preferences_exercise_idx on public.exercise_preferences (exercise_id);
create trigger exercise_preferences_updated_at before update on public.exercise_preferences
  for each row execute function public.set_updated_at();

alter table public.exercise_preferences enable row level security;
revoke all on public.exercise_preferences from public, anon, authenticated;
grant select, insert, update, delete on public.exercise_preferences to authenticated;

create policy exercise_preferences_own on public.exercise_preferences
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.exercises e
      where e.id = exercise_id and e.archived_at is null
        and (e.owner_id is null or e.owner_id = (select auth.uid()))
    )
  );
